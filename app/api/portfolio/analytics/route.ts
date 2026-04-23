import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { prisma } from '@/src/lib/prisma';
import { fetchHistoryWithFallback } from '@/src/lib/providers';
import { getCachedQuotes } from '@/src/lib/quote-cache';
import { getSectors } from '@/src/lib/sector-cache';

const DEFAULT_DAYS = 90;
const MAX_DAYS = 365 * 5;

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 20, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days =
    Number.isFinite(daysParam) && daysParam > 0
      ? Math.min(Math.floor(daysParam), MAX_DAYS)
      : DEFAULT_DAYS;

  const holdings = await prisma.holding.findMany({ where: { userId } });
  if (holdings.length === 0) {
    return NextResponse.json({ days, sectors: [], performance: [] });
  }

  const symbols = holdings.map((h) => h.symbol);

  const [quotes, sectors, histories] = await Promise.all([
    getCachedQuotes(symbols),
    getSectors(symbols),
    Promise.all(
      symbols.map(async (symbol) => {
        try {
          const points = await fetchHistoryWithFallback(symbol, days);
          return { symbol, points };
        } catch {
          return { symbol, points: [] };
        }
      }),
    ),
  ]);

  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  // ── Sector allocation ────────────────────────────────────────────────────
  const sectorTotals = new Map<string, number>();
  let totalValue = 0;
  for (const holding of holdings) {
    const shares = Number(holding.shares);
    const price = quoteMap.get(holding.symbol)?.currentPrice ?? Number(holding.averageCost);
    const value = shares * price;
    totalValue += value;
    const sector = sectors[holding.symbol] || 'Unknown';
    sectorTotals.set(sector, (sectorTotals.get(sector) ?? 0) + value);
  }
  const sectorAllocation = Array.from(sectorTotals.entries())
    .map(([sector, value]) => ({
      sector,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // ── Portfolio performance timeseries ─────────────────────────────────────
  const sharesBySymbol = new Map<string, number>(holdings.map((h) => [h.symbol, Number(h.shares)]));

  // Intersect the set of dates available across all symbols (drop days where any
  // symbol is missing to avoid phantom dips on partial data).
  const dateSetsBySymbol = histories.map(
    ({ points }) => new Set(points.map((p) => toIsoDate(p.date))),
  );
  const commonDates = dateSetsBySymbol.reduce<Set<string>>((acc, set, idx) => {
    if (idx === 0) return new Set(set);
    return new Set(Array.from(acc).filter((d) => set.has(d)));
  }, new Set());

  const closesBySymbolDate = new Map<string, Map<string, number>>();
  for (const { symbol, points } of histories) {
    const map = new Map<string, number>();
    for (const point of points) {
      map.set(toIsoDate(point.date), point.close);
    }
    closesBySymbolDate.set(symbol, map);
  }

  const performance = Array.from(commonDates)
    .sort()
    .map((date) => {
      let value = 0;
      for (const [symbol, shares] of sharesBySymbol) {
        const close = closesBySymbolDate.get(symbol)?.get(date);
        if (typeof close !== 'number') continue;
        value += close * shares;
      }
      return { date, value };
    });

  return NextResponse.json({ days, sectors: sectorAllocation, performance });
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
