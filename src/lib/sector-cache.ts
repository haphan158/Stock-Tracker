import { createUpstreamCooldown } from '@/src/lib/upstream-cooldown';
import yahooFinance from '@/src/lib/yahoo-finance-instance';

/**
 * Cache for per-symbol sector lookups (Yahoo `assetProfile`). Sectors are
 * effectively static per company, so:
 *
 *   - FRESH window is long (24h) — we refresh once a day.
 *   - STALE window is a full week — after the fresh TTL expires but before
 *     the stale window ends, we'll still surface the cached sector if the
 *     upstream call errors or is in cooldown.
 *   - Cooldown mirrors quote-cache: when Yahoo starts returning 429s we stop
 *     hammering the asset-profile endpoint for 5–30 minutes.
 */

const FRESH_TTL_MS = 24 * 60 * 60_000;
const STALE_TTL_MS = 7 * 24 * 60 * 60_000;

interface SectorEntry {
  sector: string | null;
  fetchedAt: number;
}

const cache = new Map<string, SectorEntry>();
const inflight = new Map<string, Promise<string | null>>();
const cooldown = createUpstreamCooldown({
  name: 'sector-cache',
  initialCooldownMs: 5 * 60_000,
  maxCooldownMs: 30 * 60_000,
});

async function fetchSectorFromUpstream(symbol: string): Promise<string | null> {
  const summary = await yahooFinance.quoteSummary(symbol, {
    modules: ['assetProfile'],
  });
  const sector = (summary.assetProfile as { sector?: string } | undefined)?.sector;
  return typeof sector === 'string' && sector.length > 0 ? sector : null;
}

function staleEntry(symbol: string, now: number): SectorEntry | null {
  const entry = cache.get(symbol);
  if (!entry) return null;
  if (now - entry.fetchedAt >= STALE_TTL_MS) return null;
  return entry;
}

async function resolveSector(symbol: string): Promise<string | null> {
  try {
    const sector = await fetchSectorFromUpstream(symbol);
    cache.set(symbol, { sector, fetchedAt: Date.now() });
    cooldown.recordSuccess();
    return sector;
  } catch (error) {
    cooldown.recordFailure(error, { symbol });
    const stale = staleEntry(symbol, Date.now());
    return stale ? stale.sector : null;
  }
}

export async function getSectors(symbols: string[]): Promise<Record<string, string | null>> {
  const now = Date.now();
  const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
  const result: Record<string, string | null> = {};

  const toFetch: string[] = [];
  for (const symbol of unique) {
    const hit = cache.get(symbol);
    if (hit && now - hit.fetchedAt < FRESH_TTL_MS) {
      result[symbol] = hit.sector;
    } else {
      toFetch.push(symbol);
    }
  }

  if (toFetch.length === 0) return result;

  if (cooldown.isCoolingDown()) {
    // Serve stale where we can; skip Yahoo entirely so we don't deepen the hole.
    for (const symbol of toFetch) {
      const stale = staleEntry(symbol, now);
      result[symbol] = stale ? stale.sector : null;
    }
    return result;
  }

  await Promise.all(
    toFetch.map(async (symbol) => {
      const existing = inflight.get(symbol);
      const promise = existing ?? resolveSector(symbol);
      if (!existing) inflight.set(symbol, promise);
      try {
        result[symbol] = await promise;
      } finally {
        if (!existing) inflight.delete(symbol);
      }
    }),
  );

  return result;
}

export function isSectorUpstreamCoolingDown(): boolean {
  return cooldown.isCoolingDown();
}
