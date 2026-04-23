import { NextResponse, type NextRequest } from 'next/server';

import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';
import { getCachedQuotes } from '@/src/lib/quote-cache';

/**
 * Walk every active alert, pull a cached quote for each distinct symbol, and
 * flip any alert whose threshold has been crossed. We record `lastTriggeredAt`
 * and set `active = false` so the same alert doesn't spam a user every cron
 * tick — reactivating is a manual action in the /alerts UI.
 *
 * Authed via a shared `CRON_SECRET` header so only the scheduler can poke it.
 * When the secret is unset (local dev) the endpoint is open — that's
 * deliberate so you can curl it while hacking.
 */
export async function GET(request: NextRequest) {
  const logger = loggerFromRequest(request);
  const expected = process.env.CRON_SECRET?.trim();
  if (expected) {
    const provided =
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      request.headers.get('x-cron-secret') ||
      '';
    if (provided !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const active = await prisma.alert.findMany({ where: { active: true } });
  if (active.length === 0) {
    return NextResponse.json({ checked: 0, triggered: 0 });
  }

  const symbols = Array.from(new Set(active.map((a) => a.symbol)));
  let quotes: { symbol: string; currentPrice: number }[] = [];
  try {
    const fetched = await getCachedQuotes(symbols);
    quotes = fetched.map((q) => ({ symbol: q.symbol, currentPrice: q.currentPrice }));
  } catch (error) {
    logger.error({ err: error }, '[cron/check-alerts] failed to fetch quotes');
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 502 });
  }
  const priceBySymbol = new Map(quotes.map((q) => [q.symbol, q.currentPrice]));

  const triggered: string[] = [];
  for (const alert of active) {
    const price = priceBySymbol.get(alert.symbol);
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) continue;

    const threshold = Number(alert.threshold);
    const hit =
      (alert.direction === 'ABOVE' && price >= threshold) ||
      (alert.direction === 'BELOW' && price <= threshold);
    if (!hit) continue;

    try {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { active: false, lastTriggeredAt: new Date() },
      });
      triggered.push(alert.id);
    } catch (error) {
      logger.error(
        { err: error, alertId: alert.id },
        '[cron/check-alerts] failed to mark alert triggered',
      );
    }
  }

  return NextResponse.json({
    checked: active.length,
    triggered: triggered.length,
    triggeredIds: triggered,
  });
}
