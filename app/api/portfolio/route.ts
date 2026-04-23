import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { enrichHolding, summarizePortfolio } from '@/src/lib/portfolio';
import { prisma } from '@/src/lib/prisma';
import { getCachedQuotes } from '@/src/lib/quote-cache';
import { holdingInputSchema } from '@/src/lib/validators';

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const holdings = await prisma.holding.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const symbols = holdings.map((h) => h.symbol);
  const quotes = await getCachedQuotes(symbols);
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));
  const enriched = holdings.map((h) => enrichHolding(h, quoteMap.get(h.symbol)));

  return NextResponse.json({
    holdings: enriched,
    summary: summarizePortfolio(enriched),
  });
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

  const parsed = holdingInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { symbol, shares, averageCost } = parsed.data;

  try {
    const holding = await prisma.holding.upsert({
      where: { userId_symbol: { userId, symbol } },
      create: { userId, symbol, shares, averageCost },
      update: { shares, averageCost },
    });
    return NextResponse.json({ holding }, { status: 201 });
  } catch (error) {
    loggerFromRequest(request).error({ err: error, userId, symbol }, 'Failed to upsert holding');
    return NextResponse.json({ error: 'Failed to save holding' }, { status: 500 });
  }
}
