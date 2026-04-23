import { fetchHistoryWithFallback } from '@/src/lib/providers';
import type { HistoricalPoint } from '@/src/lib/providers/types';
import { createUpstreamCooldown } from '@/src/lib/upstream-cooldown';

/**
 * Stale-while-error cache for historical close prices.
 *
 * Past closes are effectively immutable, so the cache can be aggressive:
 *   - FRESH window is 30 minutes — long enough to absorb a burst of analytics
 *     requests (one per holding × a few hits per page load) without fanning
 *     out to Yahoo / Twelve Data every time.
 *   - STALE window is 24 hours — if both upstreams are unhappy, the analytics
 *     chart keeps rendering yesterday's curve instead of going empty.
 *   - COOLDOWN shields Twelve Data's 8/min free quota from repeated retries
 *     after a 429.
 *
 * Keyed by `(symbol, days)` so different request windows don't collide.
 */

const FRESH_TTL_MS = 30 * 60_000; // 30 minutes
const STALE_TTL_MS = 24 * 60 * 60_000; // 24 hours

interface CacheEntry {
  points: HistoricalPoint[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<HistoricalPoint[]>>();
const cooldown = createUpstreamCooldown({
  name: 'history-cache',
  initialCooldownMs: 5 * 60_000,
  maxCooldownMs: 30 * 60_000,
});

function cacheKey(symbol: string, days: number): string {
  return `${symbol.toUpperCase()}:${days}`;
}

function staleEntry(key: string, now: number): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (now - entry.fetchedAt >= STALE_TTL_MS) return null;
  return entry;
}

async function fetchAndStore(
  symbol: string,
  days: number,
  key: string,
): Promise<HistoricalPoint[]> {
  try {
    const points = await fetchHistoryWithFallback(symbol, days);
    // Only overwrite on a useful result. An empty upstream response (e.g.
    // invalid symbol, silent upstream hiccup) must NOT replace a good stale
    // entry — otherwise the stale fallback below can't recover it.
    if (points.length > 0) {
      cache.set(key, { points, fetchedAt: Date.now() });
    }
    cooldown.recordSuccess();
    return points;
  } catch (error) {
    cooldown.recordFailure(error, { symbol, days });
    return [];
  }
}

function coalesce(symbol: string, days: number, key: string): Promise<HistoricalPoint[]> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = fetchAndStore(symbol, days, key).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/**
 * Cached historical close prices. Returns [] when both upstreams are failing
 * and we have no stale value to fall back on.
 */
export async function getCachedHistory(symbol: string, days: number): Promise<HistoricalPoint[]> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized || !(days > 0)) return [];

  const key = cacheKey(normalized, days);
  const now = Date.now();
  const entry = cache.get(key);

  if (entry && now - entry.fetchedAt < FRESH_TTL_MS) {
    return entry.points;
  }

  if (cooldown.isCoolingDown()) {
    const stale = staleEntry(key, now);
    return stale ? stale.points : [];
  }

  const fresh = await coalesce(normalized, days, key);
  if (fresh.length > 0) return fresh;

  // Upstream returned empty (or failed and fell through) — prefer stale over
  // showing an empty chart.
  const stale = staleEntry(key, Date.now());
  return stale ? stale.points : [];
}

export function isHistoryUpstreamCoolingDown(): boolean {
  return cooldown.isCoolingDown();
}
