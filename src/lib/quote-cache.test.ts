import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as QuoteCacheModule from '@/src/lib/quote-cache';
import type { StockData } from '@/src/lib/stock-service';

// Module-level state (the cache map, cooldown timers, etc.) means each test
// needs a fresh copy of quote-cache.ts. We reset the module registry and
// re-import inside each test after configuring the mock.
type QuoteCache = typeof QuoteCacheModule;

// `vi.hoisted` is the supported way to share a mock fn between the test file
// and the hoisted `vi.mock` factory (which otherwise runs before test-file
// locals are initialized).
const { getMultipleStocks } = vi.hoisted(() => ({
  getMultipleStocks: vi.fn<(symbols: string[]) => Promise<StockData[]>>(),
}));

vi.mock('@/src/lib/stock-service', () => {
  return {
    StockService: {
      getMultipleStocks: (symbols: string[]) => getMultipleStocks(symbols),
    },
  };
});

function quote(symbol: string, price = 100): StockData {
  return {
    symbol,
    name: symbol,
    currentPrice: price,
    change: 0,
    changePercent: 0,
    lastUpdated: new Date(),
  };
}

async function loadModule(): Promise<QuoteCache> {
  vi.resetModules();
  return import('@/src/lib/quote-cache');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  getMultipleStocks.mockReset();
  // Silence the warn/log calls from quote-cache so test output stays readable.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getCachedQuotes — fresh / upstream fetch', () => {
  it('fetches upstream on a cold cache and returns the data', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    const mod = await loadModule();

    const result = await mod.getCachedQuotes(['AAPL']);

    expect(result).toEqual([quote('AAPL', 150)]);
    expect(getMultipleStocks).toHaveBeenCalledTimes(1);
    expect(getMultipleStocks).toHaveBeenCalledWith(['AAPL']);
  });

  it('serves from cache when within the fresh TTL (< 60s)', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    const mod = await loadModule();

    await mod.getCachedQuotes(['AAPL']);
    vi.advanceTimersByTime(30_000); // 30s later
    await mod.getCachedQuotes(['AAPL']);

    expect(getMultipleStocks).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after the fresh TTL elapses', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 155)]);
    const mod = await loadModule();

    await mod.getCachedQuotes(['AAPL']);
    vi.advanceTimersByTime(61_000); // past 60s fresh TTL
    const result = await mod.getCachedQuotes(['AAPL']);

    expect(result[0]?.currentPrice).toBe(155);
    expect(getMultipleStocks).toHaveBeenCalledTimes(2);
  });

  it('normalizes input symbols (trim, upper-case, dedupe) before fetching', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150), quote('MSFT', 300)]);
    const mod = await loadModule();

    await mod.getCachedQuotes(['aapl', '  AAPL ', 'msft']);

    expect(getMultipleStocks).toHaveBeenCalledWith(['AAPL', 'MSFT']);
  });

  it('returns [] for an empty input list without hitting upstream', async () => {
    const mod = await loadModule();
    const result = await mod.getCachedQuotes([]);
    expect(result).toEqual([]);
    expect(getMultipleStocks).not.toHaveBeenCalled();
  });

  it('preserves caller ordering even after upstream reorders', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('MSFT', 300), quote('AAPL', 150)]);
    const mod = await loadModule();

    const result = await mod.getCachedQuotes(['AAPL', 'MSFT']);
    expect(result.map((s) => s.symbol)).toEqual(['AAPL', 'MSFT']);
  });

  it('splits the request into cached + needed symbols', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    getMultipleStocks.mockResolvedValueOnce([quote('MSFT', 300)]);
    const mod = await loadModule();

    await mod.getCachedQuotes(['AAPL']);
    vi.advanceTimersByTime(30_000);
    await mod.getCachedQuotes(['AAPL', 'MSFT']);

    expect(getMultipleStocks).toHaveBeenCalledTimes(2);
    expect(getMultipleStocks.mock.calls[1]?.[0]).toEqual(['MSFT']);
  });
});

describe('getCachedQuotes — inflight dedup (coalesce)', () => {
  it('merges two concurrent calls for the same symbols into one upstream hit', async () => {
    let resolveFetch!: (stocks: StockData[]) => void;
    getMultipleStocks.mockImplementationOnce(
      () =>
        new Promise<StockData[]>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const mod = await loadModule();

    const a = mod.getCachedQuotes(['AAPL']);
    const b = mod.getCachedQuotes(['AAPL']);

    expect(getMultipleStocks).toHaveBeenCalledTimes(1);

    resolveFetch([quote('AAPL', 150)]);
    const [resA, resB] = await Promise.all([a, b]);

    expect(resA[0]?.currentPrice).toBe(150);
    expect(resB[0]?.currentPrice).toBe(150);
  });

  it('allows a new upstream call after the inflight promise settles', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 160)]);
    const mod = await loadModule();

    await mod.getCachedQuotes(['AAPL']);
    vi.advanceTimersByTime(61_000);
    await mod.getCachedQuotes(['AAPL']);

    expect(getMultipleStocks).toHaveBeenCalledTimes(2);
  });
});

describe('getCachedQuotes — stale-while-error & cooldown backoff', () => {
  it('serves a stale value when upstream errors and a cached entry still exists', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    const mod = await loadModule();

    await mod.getCachedQuotes(['AAPL']); // warm cache
    vi.advanceTimersByTime(61_000); // past fresh TTL
    getMultipleStocks.mockRejectedValueOnce(new Error('Yahoo 429'));

    const result = await mod.getCachedQuotes(['AAPL']);

    // Stale value is returned because the upstream call failed.
    expect(result).toHaveLength(1);
    expect(result[0]?.symbol).toBe('AAPL');
    expect(result[0]?.currentPrice).toBe(150);
  });

  it('enters cooldown after an upstream error and skips Yahoo during that window', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    const mod = await loadModule();

    await mod.getCachedQuotes(['AAPL']); // warm cache
    vi.advanceTimersByTime(61_000);
    getMultipleStocks.mockRejectedValueOnce(new Error('Yahoo 429'));
    await mod.getCachedQuotes(['AAPL']); // triggers cooldown

    expect(mod.isUpstreamCoolingDown()).toBe(true);

    // Any call inside the cooldown window should skip upstream entirely and
    // return stale data.
    getMultipleStocks.mockClear();
    vi.advanceTimersByTime(60_000); // still inside the 5-min cooldown
    const staleRes = await mod.getCachedQuotes(['AAPL']);

    expect(getMultipleStocks).not.toHaveBeenCalled();
    expect(staleRes).toHaveLength(1);
    expect(staleRes[0]?.symbol).toBe('AAPL');
    expect(staleRes[0]?.currentPrice).toBe(150);
  });

  it('returns an empty array in cooldown for symbols that have never been cached', async () => {
    const mod = await loadModule();

    // Put into cooldown by triggering a first-time error.
    getMultipleStocks.mockRejectedValueOnce(new Error('down'));
    await mod.getCachedQuotes(['AAPL']);
    expect(mod.isUpstreamCoolingDown()).toBe(true);

    getMultipleStocks.mockClear();
    const result = await mod.getCachedQuotes(['MSFT']);
    expect(result).toEqual([]);
    expect(getMultipleStocks).not.toHaveBeenCalled();
  });

  it('resumes fetching after the cooldown expires and resets the window on success', async () => {
    getMultipleStocks.mockRejectedValueOnce(new Error('down'));
    const mod = await loadModule();
    await mod.getCachedQuotes(['AAPL']); // 5-min cooldown begins

    vi.advanceTimersByTime(5 * 60_000 + 1); // just past the 5-min cooldown
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    const result = await mod.getCachedQuotes(['AAPL']);

    expect(result).toEqual([quote('AAPL', 150)]);
    expect(mod.isUpstreamCoolingDown()).toBe(false);
  });

  it('doubles the cooldown on repeated failures and caps at 30 minutes', async () => {
    const mod = await loadModule();

    // 1st failure → 5-min cooldown.
    getMultipleStocks.mockRejectedValueOnce(new Error('fail-1'));
    await mod.getCachedQuotes(['AAPL']);
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(mod.isUpstreamCoolingDown()).toBe(false);

    // 2nd failure → 10-min cooldown.
    getMultipleStocks.mockRejectedValueOnce(new Error('fail-2'));
    await mod.getCachedQuotes(['AAPL']);
    vi.advanceTimersByTime(10 * 60_000 - 1);
    expect(mod.isUpstreamCoolingDown()).toBe(true);
    vi.advanceTimersByTime(2);
    expect(mod.isUpstreamCoolingDown()).toBe(false);

    // 3rd failure → 20-min cooldown.
    getMultipleStocks.mockRejectedValueOnce(new Error('fail-3'));
    await mod.getCachedQuotes(['AAPL']);
    vi.advanceTimersByTime(20 * 60_000 - 1);
    expect(mod.isUpstreamCoolingDown()).toBe(true);
    vi.advanceTimersByTime(2);
    expect(mod.isUpstreamCoolingDown()).toBe(false);

    // 4th failure → capped at 30-min cooldown (not 40).
    getMultipleStocks.mockRejectedValueOnce(new Error('fail-4'));
    await mod.getCachedQuotes(['AAPL']);
    vi.advanceTimersByTime(30 * 60_000 - 1);
    expect(mod.isUpstreamCoolingDown()).toBe(true);
    vi.advanceTimersByTime(2);
    expect(mod.isUpstreamCoolingDown()).toBe(false);
  });

  it('drops stale entries older than 30 minutes', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    const mod = await loadModule();

    await mod.getCachedQuotes(['AAPL']);
    vi.advanceTimersByTime(31 * 60_000); // past STALE_TTL
    getMultipleStocks.mockRejectedValueOnce(new Error('down'));

    const result = await mod.getCachedQuotes(['AAPL']);
    expect(result).toEqual([]);
  });

  it('falls back to a stale entry when upstream succeeds but omits the symbol', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150), quote('MSFT', 300)]);
    const mod = await loadModule();

    await mod.getCachedQuotes(['AAPL', 'MSFT']); // both cached
    vi.advanceTimersByTime(61_000);
    // Second fetch only returns AAPL (MSFT silently dropped by upstream).
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 155)]);

    const result = await mod.getCachedQuotes(['AAPL', 'MSFT']);

    expect(result.map((r) => [r.symbol, r.currentPrice])).toEqual([
      ['AAPL', 155],
      ['MSFT', 300], // stale fallback
    ]);
  });
});

describe('getCachedQuote (single)', () => {
  it('returns the first match from the underlying batch', async () => {
    getMultipleStocks.mockResolvedValueOnce([quote('AAPL', 150)]);
    const mod = await loadModule();

    const result = await mod.getCachedQuote('AAPL');
    expect(result?.currentPrice).toBe(150);
  });

  it('returns null when the batch is empty', async () => {
    getMultipleStocks.mockResolvedValueOnce([]);
    const mod = await loadModule();

    const result = await mod.getCachedQuote('NOPE');
    expect(result).toBeNull();
  });
});
