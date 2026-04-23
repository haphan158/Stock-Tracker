import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';
import { derivePositionFromTransactions, toTransactionView } from '@/src/lib/transactions';
import { transactionPatchSchema } from '@/src/lib/validators';

async function recomputeHoldingFor(portfolioId: string, symbol: string, userId: string) {
  const all = await prisma.transaction.findMany({
    where: { portfolioId, symbol },
    orderBy: { executedAt: 'asc' },
  });
  const derived = derivePositionFromTransactions(symbol, all);

  if (!derived || derived.shares <= 0) {
    await prisma.holding.deleteMany({ where: { portfolioId, symbol } });
    return;
  }

  await prisma.holding.upsert({
    where: { portfolioId_symbol: { portfolioId, symbol } },
    create: {
      userId,
      portfolioId,
      symbol,
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
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 30, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = transactionPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.shares !== undefined) data.shares = parsed.data.shares;
  if (parsed.data.price !== undefined) data.price = parsed.data.price;
  if (parsed.data.fee !== undefined) data.fee = parsed.data.fee;
  if (parsed.data.currency !== undefined) data.currency = parsed.data.currency;
  if (parsed.data.executedAt !== undefined) data.executedAt = parsed.data.executedAt;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
  if (parsed.data.type !== undefined) data.type = parsed.data.type;

  try {
    const updated = await prisma.transaction.update({ where: { id }, data });
    await recomputeHoldingFor(updated.portfolioId, updated.symbol, userId);
    return NextResponse.json({ transaction: toTransactionView(updated) });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, userId, txId: id },
      'Failed to update transaction',
    );
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 30, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;
  const { id } = await context.params;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await prisma.transaction.delete({ where: { id } });
    await recomputeHoldingFor(existing.portfolioId, existing.symbol, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, userId, txId: id },
      'Failed to delete transaction',
    );
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
