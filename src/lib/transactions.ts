import type { Transaction } from '@prisma/client';

import { prisma } from '@/src/lib/prisma';

export interface TransactionView {
  id: string;
  portfolioId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  fee: number | null;
  currency: string;
  executedAt: string;
  notes: string | null;
  createdAt: string;
}

export function toTransactionView(tx: Transaction): TransactionView {
  return {
    id: tx.id,
    portfolioId: tx.portfolioId,
    symbol: tx.symbol,
    type: tx.type,
    shares: Number(tx.shares),
    price: Number(tx.price),
    fee: tx.fee === null ? null : Number(tx.fee),
    currency: tx.currency,
    executedAt: tx.executedAt.toISOString(),
    notes: tx.notes,
    createdAt: tx.createdAt.toISOString(),
  };
}

export interface DerivedPosition {
  symbol: string;
  shares: number;
  /** Weighted average cost per share, based on BUYs only. */
  averageCost: number;
  realizedGain: number;
  totalFees: number;
  /** Dominant currency (first seen). */
  currency: string;
}

/**
 * Replay a set of transactions for a single symbol into a current position.
 * BUY lines update the weighted-average cost; SELL lines deduct shares and
 * book realized P/L at the running average cost (FIFO-equivalent for flat
 * cost-basis accounting, which is what we display today).
 */
export function derivePositionFromTransactions(
  symbol: string,
  transactions: Transaction[],
): DerivedPosition | null {
  // Iterate chronologically so weighted-average cost stays consistent regardless
  // of the order rows come back from the database.
  const sorted = [...transactions].sort((a, b) => a.executedAt.getTime() - b.executedAt.getTime());

  let shares = 0;
  let costBasis = 0;
  let realizedGain = 0;
  let totalFees = 0;
  let currency = 'USD';
  let sawAny = false;

  for (const tx of sorted) {
    const qty = Number(tx.shares);
    const price = Number(tx.price);
    const fee = tx.fee === null ? 0 : Number(tx.fee);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;

    sawAny = true;
    if (!currency || currency === 'USD') currency = tx.currency || currency;
    totalFees += fee;

    if (tx.type === 'BUY') {
      costBasis += qty * price + fee;
      shares += qty;
    } else {
      const avg = shares > 0 ? costBasis / shares : 0;
      const sold = Math.min(qty, shares);
      // Realized P/L for the portion we can actually cover; fees reduce it.
      realizedGain += (price - avg) * sold - fee;
      costBasis -= avg * sold;
      shares -= sold;
      if (shares < 1e-9) {
        shares = 0;
        costBasis = 0;
      }
    }
  }

  if (!sawAny) return null;

  const averageCost = shares > 0 ? costBasis / shares : 0;
  return {
    symbol,
    shares,
    averageCost,
    realizedGain,
    totalFees,
    currency,
  };
}

/**
 * Atomically record a transaction and re-materialize the matching Holding row
 * inside one DB transaction. Keeps reads fast (dashboard still selects from
 * Holding) while Transaction remains the authoritative ledger.
 */
export async function recordTransactionAndRecomputeHolding(args: {
  userId: string;
  portfolioId: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  fee?: number | null;
  currency: string;
  executedAt: Date;
  notes?: string | null;
}): Promise<{ transaction: Transaction; holdingRemoved: boolean }> {
  return prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        userId: args.userId,
        portfolioId: args.portfolioId,
        symbol: args.symbol,
        type: args.type,
        shares: args.shares,
        price: args.price,
        fee: args.fee ?? null,
        currency: args.currency,
        executedAt: args.executedAt,
        notes: args.notes ?? null,
      },
    });

    const allForSymbol = await tx.transaction.findMany({
      where: { portfolioId: args.portfolioId, symbol: args.symbol },
      orderBy: { executedAt: 'asc' },
    });

    const derived = derivePositionFromTransactions(args.symbol, allForSymbol);

    if (!derived || derived.shares <= 0) {
      await tx.holding.deleteMany({
        where: { portfolioId: args.portfolioId, symbol: args.symbol },
      });
      return { transaction: created, holdingRemoved: true };
    }

    await tx.holding.upsert({
      where: { portfolioId_symbol: { portfolioId: args.portfolioId, symbol: args.symbol } },
      create: {
        userId: args.userId,
        portfolioId: args.portfolioId,
        symbol: args.symbol,
        shares: derived.shares,
        averageCost: derived.averageCost,
        currency: derived.currency,
      },
      update: {
        shares: derived.shares,
        averageCost: derived.averageCost,
        currency: derived.currency,
      },
    });

    return { transaction: created, holdingRemoved: false };
  });
}
