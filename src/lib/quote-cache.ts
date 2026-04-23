import { StockService, type StockData } from '@/src/lib/stock-service';
import { createUpstreamCooldown } from '@/src/lib/upstream-cooldown';

/**
 * Stale-while-error cache for Yahoo Finance quotes.
 *
 *  - FRESH window: data is served straight from memory without any upstream call.
 *  - STALE window: data is returned immediately while a background refresh runs.
 *    If that refresh fails, the stale value is still returned (instead of 502).
 *  - On upstream error we enter a COOLDOWN period during which we skip all
 *    upstream calls and only serve stale data (or empty). This protects Yahoo
 *    from repeated retries when we're rate-limited.
 */

type CacheEntry = { data: StockData; fetchedAt: number };

const FRESH_TTL_MS = 60_000; // 1 minute
const STALE_TTL_MS = 30 * 60_000; // 30 minutes

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Map<string, StockData>>>();
const cooldown = createUpstreamCooldown({
  name: 'quote-cache',
  initialCooldownMs: 5 * 60_000,
  maxCooldownMs: 30 * 60_000,
});

function getEntry(symbol: string) {
  return cache.get(symbol);
}

function store(stocks: StockData[], now: number) {
  for (const stock of stocks) {
    cache.set(stock.symbol, { data: stock, fetchedAt: now });
  }
}

async function fetchAndStore(symbols: string[]): Promise<Map<string, StockData>> {
  if (symbols.length === 0) return new Map();

  try {
    const stocks = await StockService.getMultipleStocks(symbols);
    store(stocks, Date.now());
    cooldown.recordSuccess();
    return new Map(stocks.map((s) => [s.symbol, s]));
  } catch (error) {
    cooldown.recordFailure(error, { symbols });
    return new Map();
  }
}

function coalesce(symbols: string[]): Promise<Map<string, StockData>> {
  const key = symbols.join(',');
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetchAndStore(symbols).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/**
 * Batched cached quote fetch. Returns cached entries immediately when fresh,
 * falls back to stale entries when upstream is cool/erroring, and only hits
 * Yahoo for symbols that truly need a refresh.
 */
export async function getCachedQuotes(rawSymbols: string[]): Promise<StockData[]> {
  const now = Date.now();
  const symbols = Array.from(new Set(rawSymbols.map((s) => s.trim().toUpperCase()))).filter(
    Boolean,
  );
  if (symbols.length === 0) return [];

  const result = new Map<string, StockData>();
  const needsFetch: string[] = [];

  for (const symbol of symbols) {
    const entry = getEntry(symbol);
    if (entry && now - entry.fetchedAt < FRESH_TTL_MS) {
      result.set(symbol, entry.data);
    } else {
      needsFetch.push(symbol);
    }
  }

  if (needsFetch.length > 0) {
    if (cooldown.isCoolingDown()) {
      // Serve stale entries where we can; skip Yahoo entirely.
      for (const symbol of needsFetch) {
        const entry = getEntry(symbol);
        if (entry && now - entry.fetchedAt < STALE_TTL_MS) {
          result.set(symbol, entry.data);
        }
      }
    } else {
      const fetched = await coalesce(needsFetch);
      for (const symbol of needsFetch) {
        const fresh = fetched.get(symbol);
        if (fresh) {
          result.set(symbol, fresh);
          continue;
        }
        // Upstream didn't return this symbol — fall back to stale if available.
        const entry = getEntry(symbol);
        if (entry && Date.now() - entry.fetchedAt < STALE_TTL_MS) {
          result.set(symbol, entry.data);
        }
      }
    }
  }

  // Preserve the caller's ordering so UI lists stay stable.
  return symbols.map((s) => result.get(s)).filter((s): s is StockData => !!s);
}

export async function getCachedQuote(symbol: string): Promise<StockData | null> {
  const [stock] = await getCachedQuotes([symbol]);
  return stock ?? null;
}

export function isUpstreamCoolingDown(): boolean {
  return cooldown.isCoolingDown();
}
