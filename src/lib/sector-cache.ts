import yahooFinance from 'yahoo-finance2';

const TTL_MS = 24 * 60 * 60 * 1000;

interface SectorEntry {
  sector: string | null;
  fetchedAt: number;
}

const cache = new Map<string, SectorEntry>();
const inflight = new Map<string, Promise<string | null>>();

async function fetchSector(symbol: string): Promise<string | null> {
  try {
    const summary = await yahooFinance.quoteSummary(symbol, {
      modules: ['assetProfile'],
    });
    const sector = (summary.assetProfile as { sector?: string } | undefined)?.sector;
    return typeof sector === 'string' && sector.length > 0 ? sector : null;
  } catch (error) {
    console.warn(
      `[sector-cache] Failed for ${symbol}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function getSectors(symbols: string[]): Promise<Record<string, string | null>> {
  const now = Date.now();
  const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
  const result: Record<string, string | null> = {};

  const toFetch: string[] = [];
  for (const symbol of unique) {
    const hit = cache.get(symbol);
    if (hit && now - hit.fetchedAt < TTL_MS) {
      result[symbol] = hit.sector;
    } else {
      toFetch.push(symbol);
    }
  }

  await Promise.all(
    toFetch.map(async (symbol) => {
      const existing = inflight.get(symbol);
      const promise = existing ?? fetchSector(symbol);
      if (!existing) inflight.set(symbol, promise);
      try {
        const sector = await promise;
        cache.set(symbol, { sector, fetchedAt: Date.now() });
        result[symbol] = sector;
      } finally {
        if (!existing) inflight.delete(symbol);
      }
    }),
  );

  return result;
}
