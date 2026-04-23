import { logger } from '@/src/lib/logger';
import yahooFinance from '@/src/lib/yahoo-finance-instance';

/**
 * Cache of FX rates keyed by "FROM:TO". Rates are (1 FROM = X TO).
 *
 * Yahoo Finance exposes currency pairs via the same quote API we already use
 * (e.g. EURUSD=X, JPYUSD=X). We call through the yahoo-finance2 client so we
 * inherit its retry + rate-limit handling; when that fails we fall back to a
 * straight cross through USD (A→USD and USD→B).
 */

const FRESH_TTL_MS = 15 * 60_000; // 15 minutes
const STALE_TTL_MS = 24 * 60 * 60_000;

interface RateEntry {
  rate: number;
  fetchedAt: number;
}

const cache = new Map<string, RateEntry>();
const inflight = new Map<string, Promise<number | null>>();

function key(from: string, to: string): string {
  return `${from.toUpperCase()}:${to.toUpperCase()}`;
}

function yahooPair(from: string, to: string): string {
  // Yahoo uses FROMTO=X (e.g. EURUSD=X). USD as the quote currency is the
  // common case; for USD→FOREIGN the expected symbol is "FOREIGN=X" (Yahoo
  // defaults the base to USD) — but FROMUSD=X is more predictable, so we use
  // it for every pair.
  return `${from.toUpperCase()}${to.toUpperCase()}=X`;
}

async function fetchDirect(from: string, to: string): Promise<number | null> {
  const pair = yahooPair(from, to);
  try {
    const quote = await yahooFinance.quote(pair);
    const price = Array.isArray(quote)
      ? (quote[0]?.regularMarketPrice ?? null)
      : (quote?.regularMarketPrice ?? null);
    if (typeof price === 'number' && price > 0) return price;
    return null;
  } catch (error) {
    logger.debug({ err: error, from, to }, '[fx-cache] direct pair lookup failed');
    return null;
  }
}

async function fetchRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;

  const direct = await fetchDirect(from, to);
  if (direct) return direct;

  // Triangulate through USD when the direct pair is missing or throttled.
  if (from !== 'USD' && to !== 'USD') {
    const [fromToUsd, usdToTarget] = await Promise.all([
      fetchDirect(from, 'USD'),
      fetchDirect('USD', to),
    ]);
    if (fromToUsd && usdToTarget) return fromToUsd * usdToTarget;
  }

  return null;
}

function coalesce(from: string, to: string): Promise<number | null> {
  const k = key(from, to);
  const existing = inflight.get(k);
  if (existing) return existing;
  const promise = fetchRate(from, to).finally(() => inflight.delete(k));
  inflight.set(k, promise);
  return promise;
}

/**
 * Fetch a single FX rate, preferring a recent cache entry and falling back to
 * a stale value if the upstream is currently failing. Returns null when we
 * have never successfully fetched the pair.
 */
export async function getFxRate(from: string, to: string): Promise<number | null> {
  const f = from.trim().toUpperCase();
  const t = to.trim().toUpperCase();
  if (!f || !t) return null;
  if (f === t) return 1;

  const k = key(f, t);
  const now = Date.now();
  const entry = cache.get(k);
  if (entry && now - entry.fetchedAt < FRESH_TTL_MS) return entry.rate;

  const fresh = await coalesce(f, t);
  if (typeof fresh === 'number') {
    cache.set(k, { rate: fresh, fetchedAt: Date.now() });
    return fresh;
  }

  if (entry && now - entry.fetchedAt < STALE_TTL_MS) return entry.rate;
  return null;
}

/**
 * Convert `amount` from `from` to `to`. When no FX rate is available we
 * return the original amount — better to show stale-in-USD totals than to
 * zero the dashboard out.
 */
export async function convertAmount(
  amount: number,
  from: string,
  to: string,
): Promise<{ amount: number; rate: number | null; converted: boolean }> {
  if (!Number.isFinite(amount)) return { amount, rate: null, converted: false };
  const f = from.trim().toUpperCase();
  const t = to.trim().toUpperCase();
  if (f === t) return { amount, rate: 1, converted: true };
  const rate = await getFxRate(f, t);
  if (rate === null) return { amount, rate: null, converted: false };
  return { amount: amount * rate, rate, converted: true };
}

/** Batched rate lookup — returns a map keyed by "FROM:TO". */
export async function getFxRates(
  pairs: Array<{ from: string; to: string }>,
): Promise<Map<string, number>> {
  const uniq = new Map<string, { from: string; to: string }>();
  for (const p of pairs) {
    const f = p.from.trim().toUpperCase();
    const t = p.to.trim().toUpperCase();
    if (!f || !t || f === t) continue;
    uniq.set(key(f, t), { from: f, to: t });
  }
  const results = await Promise.all(
    Array.from(uniq.values()).map(async ({ from, to }) => {
      const rate = await getFxRate(from, to);
      return [key(from, to), rate] as const;
    }),
  );
  const out = new Map<string, number>();
  for (const [k, rate] of results) {
    if (typeof rate === 'number') out.set(k, rate);
  }
  return out;
}
