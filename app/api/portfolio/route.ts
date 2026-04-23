import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { getFxRates } from '@/src/lib/fx-cache';
import { loggerFromRequest } from '@/src/lib/logger';
import { enrichHolding, summarizePortfolio } from '@/src/lib/portfolio';
import { ensureDefaultPortfolio, resolvePortfolio } from '@/src/lib/portfolios';
import { prisma } from '@/src/lib/prisma';
import { getCachedQuotes } from '@/src/lib/quote-cache';
import { getUserPreferences } from '@/src/lib/user-preferences';
import { holdingInputSchema } from '@/src/lib/validators';

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const portfolioIdParam = request.nextUrl.searchParams.get('portfolioId');
  const portfolio = await resolvePortfolio(userId, portfolioIdParam);
  if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });

  const holdings = await prisma.holding.findMany({
    where: { portfolioId: portfolio.id },
    orderBy: { createdAt: 'desc' },
  });

  const symbols = holdings.map((h) => h.symbol);
  const [quotes, prefs] = await Promise.all([getCachedQuotes(symbols), getUserPreferences(userId)]);
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  const enriched = holdings.map((h) => enrichHolding(h, quoteMap.get(h.symbol)));

  // Convert to the user's preferred display currency. Quotes come back in the
  // symbol's native currency (which we stash on the Holding at write-time);
  // falling back to USD keeps pre-multi-currency rows rendering sensibly.
  const displayCurrency = prefs.displayCurrency;
  const pairs = Array.from(new Set(enriched.map((h) => h.currency))).map((c) => ({
    from: c,
    to: displayCurrency,
  }));
  const rates = await getFxRates(pairs);

  const enrichedInDisplay = enriched.map((h) => {
    if (h.currency === displayCurrency) return h;
    const rate = rates.get(`${h.currency}:${displayCurrency}`);
    if (!rate || !Number.isFinite(rate)) return h;
    return {
      ...h,
      averageCost: h.averageCost * rate,
      currentPrice: h.currentPrice * rate,
      marketValue: h.marketValue * rate,
      costBasis: h.costBasis * rate,
      gainLoss: h.gainLoss * rate,
      change: h.change * rate,
      currency: displayCurrency,
    };
  });

  return NextResponse.json({
    portfolio: { id: portfolio.id, name: portfolio.name, isDefault: portfolio.isDefault },
    holdings: enrichedInDisplay,
    summary: summarizePortfolio(enrichedInDisplay),
    displayCurrency,
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

  const { symbol, shares, averageCost, currency, portfolioId } = parsed.data;

  const portfolio = portfolioId
    ? await resolvePortfolio(userId, portfolioId)
    : await ensureDefaultPortfolio(userId);
  if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });

  // We store cost basis in whatever currency the user entered (defaulting to
  // their display-currency preference), and convert at render time. That
  // matches how the form is presented and keeps per-symbol amounts stable if
  // they ever change their display currency.
  const prefs = await getUserPreferences(userId);
  const storedCurrency = currency ?? prefs.displayCurrency;

  try {
    const holding = await prisma.holding.upsert({
      where: { portfolioId_symbol: { portfolioId: portfolio.id, symbol } },
      create: {
        userId,
        portfolioId: portfolio.id,
        symbol,
        shares,
        averageCost,
        currency: storedCurrency,
      },
      update: {
        shares,
        averageCost,
        currency: storedCurrency,
      },
    });
    return NextResponse.json({ holding }, { status: 201 });
  } catch (error) {
    loggerFromRequest(request).error({ err: error, userId, symbol }, 'Failed to upsert holding');
    return NextResponse.json({ error: 'Failed to save holding' }, { status: 500 });
  }
}
