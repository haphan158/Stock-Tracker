import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { resolvePortfolio } from '@/src/lib/portfolios';
import { prisma } from '@/src/lib/prisma';
import { toTransactionView, recordTransactionAndRecomputeHolding } from '@/src/lib/transactions';
import { getUserPreferences } from '@/src/lib/user-preferences';
import { symbolSchema, transactionInputSchema } from '@/src/lib/validators';

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const params = request.nextUrl.searchParams;
  const symbolParam = params.get('symbol');
  const portfolioIdParam = params.get('portfolioId');

  let symbol: string | undefined;
  if (symbolParam) {
    const parsed = symbolSchema.safeParse(symbolParam);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
    }
    symbol = parsed.data;
  }

  let portfolioId: string | undefined;
  if (portfolioIdParam) {
    const portfolio = await resolvePortfolio(userId, portfolioIdParam);
    if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    portfolioId = portfolio.id;
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      ...(portfolioId ? { portfolioId } : {}),
      ...(symbol ? { symbol } : {}),
    },
    orderBy: [{ executedAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });

  return NextResponse.json({ transactions: transactions.map(toTransactionView) });
}

export async function POST(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 30, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = transactionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const portfolio = await resolvePortfolio(userId, input.portfolioId ?? null);
  if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });

  const prefs = await getUserPreferences(userId);
  const currency = input.currency ?? prefs.displayCurrency;

  try {
    const { transaction } = await recordTransactionAndRecomputeHolding({
      userId,
      portfolioId: portfolio.id,
      symbol: input.symbol,
      type: input.type,
      shares: input.shares,
      price: input.price,
      fee: input.fee ?? null,
      currency,
      executedAt: input.executedAt,
      notes: input.notes ?? null,
    });
    return NextResponse.json({ transaction: toTransactionView(transaction) }, { status: 201 });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, userId, symbol: input.symbol },
      'Failed to record transaction',
    );
    return NextResponse.json({ error: 'Failed to record transaction' }, { status: 500 });
  }
}
