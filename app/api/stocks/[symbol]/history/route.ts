import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { getCachedHistory } from '@/src/lib/history-cache';
import { loggerFromRequest } from '@/src/lib/logger';
import { symbolSchema } from '@/src/lib/validators';

const MAX_DAYS = 365 * 5;
const DEFAULT_DAYS = 180;

export async function GET(request: NextRequest, context: { params: Promise<{ symbol: string }> }) {
  const guard = await guardRequest(request, {
    requireAuth: false,
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;

  const { symbol: rawSymbol } = await context.params;
  const parsed = symbolSchema.safeParse(rawSymbol);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  const daysParam = Number(request.nextUrl.searchParams.get('days'));
  const days =
    Number.isFinite(daysParam) && daysParam > 0
      ? Math.min(Math.floor(daysParam), MAX_DAYS)
      : DEFAULT_DAYS;

  try {
    const points = await getCachedHistory(parsed.data, days);
    return NextResponse.json({
      symbol: parsed.data,
      days,
      points: points.map((p) => ({ date: p.date.toISOString().slice(0, 10), close: p.close })),
    });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, symbol: parsed.data, days },
      'Failed to load stock history',
    );
    return NextResponse.json({ error: 'Failed to load history' }, { status: 502 });
  }
}
