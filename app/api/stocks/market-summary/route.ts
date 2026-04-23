import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { getCachedQuotes } from '@/src/lib/quote-cache';

const POPULAR_SYMBOLS = [
  'AAPL',
  'GOOGL',
  'MSFT',
  'TSLA',
  'AMZN',
  'NVDA',
  'META',
  'BRK-B',
  'JPM',
  'JNJ',
  'V',
  'PG',
  'UNH',
  'HD',
  'MA',
  'DIS',
  'PYPL',
  'ADBE',
];

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    requireAuth: false,
    rateLimit: { limit: 20, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;

  // getCachedQuotes never throws on upstream failure — it returns stale or [].
  const stocks = await getCachedQuotes(POPULAR_SYMBOLS);

  const gainers = stocks
    .filter((stock) => stock.change > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);

  const losers = stocks
    .filter((stock) => stock.change < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 5);

  const mostActive = [...stocks].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 5);

  return NextResponse.json({ gainers, losers, mostActive });
}
