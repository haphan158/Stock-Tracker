import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as HistoryCacheModule from '@/src/lib/history-cache';
import type { HistoricalPoint } from '@/src/lib/providers/types';

type HistoryCache = typeof HistoryCacheModule;

const { fetchHistoryWithFallback } = vi.hoisted(() => ({
  fetchHistoryWithFallback: vi.fn<(symbol: string, days: number) => Promise<HistoricalPoint[]>>(),
}));

vi.mock('@/src/lib/providers', () => ({
  fetchHistoryWithFallback: (symbol: string, days: number) =>
    fetchHistoryWithFallback(symbol, days),
}));

function point(iso: string, close: number): HistoricalPoint {
  return { date: new Date(iso), close };
}

async function loadModule(): Promise<HistoryCache> {
  vi.resetModules();
  return import('@/src/lib/history-cache');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  fetchHistoryWithFallback.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getCachedHistory — fresh / upstream fetch', () => {
  it('fetches upstream on a cold cache and returns the data', async () => {
    fetchHistoryWithFallback.mockResolvedValueOnce([point('2026-01-01', 150)]);
    const mod = await loadModule();

    const result = await mod.getCachedHistory('AAPL', 30);

    expect(result).toEqual([point('2026-01-01', 150)]);
    expect(fetchHistoryWithFallback).toHaveBeenCalledWith('AAPL', 30);
  });

  it('serves from cache within the 30-minute fresh TTL', async () => {
    fetchHistoryWithFallback.mockResolvedValueOnce([point('2026-01-01', 150)]);
    const mod = await loadModule();

    await mod.getCachedHistory('AAPL', 30);
    vi.advanceTimersByTime(29 * 60_000);
    await mod.getCachedHistory('AAPL', 30);

    expect(fetchHistoryWithFallback).toHaveBeenCalledTimes(1);
  });

  it('keys the cache by (symbol, days) — same symbol at different windows re-fetches', async () => {
    fetchHistoryWithFallback.mockResolvedValueOnce([point('2026-01-01', 150)]);
    fetchHistoryWithFallback.mockResolvedValueOnce([point('2026-01-01', 150)]);
    const mod = await loadModule();

    await mod.getCachedHistory('AAPL', 30);
    await mod.getCachedHistory('AAPL', 90);

    expect(fetchHistoryWithFallback).toHaveBeenCalledTimes(2);
    expect(fetchHistoryWithFallback.mock.calls[0]).toEqual(['AAPL', 30]);
    expect(fetchHistoryWithFallback.mock.calls[1]).toEqual(['AAPL', 90]);
  });

  it('normalizes the symbol before caching', async () => {
    fetchHistoryWithFallback.mockResolvedValue([point('2026-01-01', 150)]);
    const mod = await loadModule();

    await mod.getCachedHistory('  aapl ', 30);
    await mod.getCachedHistory('AAPL', 30);

    expect(fetchHistoryWithFallback).toHaveBeenCalledTimes(1);
  });

  it('returns [] for empty or non-positive inputs without hitting upstream', async () => {
    const mod = await loadModule();

    expect(await mod.getCachedHistory('', 30)).toEqual([]);
    expect(await mod.getCachedHistory('AAPL', 0)).toEqual([]);
    expect(await mod.getCachedHistory('AAPL', -5)).toEqual([]);
    expect(fetchHistoryWithFallback).not.toHaveBeenCalled();
  });
});

describe('getCachedHistory — stale-while-error & cooldown', () => {
  it('serves stale points when upstream errors after the fresh window expires', async () => {
    fetchHistoryWithFallback.mockResolvedValueOnce([point('2026-01-01', 150)]);
    const mod = await loadModule();

    await mod.getCachedHistory('AAPL', 30);
    vi.advanceTimersByTime(31 * 60_000); // past fresh TTL
    fetchHistoryWithFallback.mockRejectedValueOnce(new Error('Yahoo 429'));

    const result = await mod.getCachedHistory('AAPL', 30);

    expect(result).toEqual([point('2026-01-01', 150)]);
    expect(mod.isHistoryUpstreamCoolingDown()).toBe(true);
  });

  it('skips upstream while in cooldown and returns stale if available', async () => {
    fetchHistoryWithFallback.mockResolvedValueOnce([point('2026-01-01', 150)]);
    const mod = await loadModule();

    await mod.getCachedHistory('AAPL', 30);
    vi.advanceTimersByTime(31 * 60_000);
    fetchHistoryWithFallback.mockRejectedValueOnce(new Error('Yahoo 429'));
    await mod.getCachedHistory('AAPL', 30); // enters cooldown

    fetchHistoryWithFallback.mockClear();
    vi.advanceTimersByTime(60_000); // still inside 5-min cooldown
    const result = await mod.getCachedHistory('AAPL', 30);

    expect(fetchHistoryWithFallback).not.toHaveBeenCalled();
    expect(result).toEqual([point('2026-01-01', 150)]);
  });

  it('returns [] during cooldown for a symbol that has never been cached', async () => {
    fetchHistoryWithFallback.mockRejectedValueOnce(new Error('down'));
    const mod = await loadModule();

    await mod.getCachedHistory('AAPL', 30); // trigger cooldown on first call
    expect(mod.isHistoryUpstreamCoolingDown()).toBe(true);

    fetchHistoryWithFallback.mockClear();
    const result = await mod.getCachedHistory('MSFT', 30);

    expect(result).toEqual([]);
    expect(fetchHistoryWithFallback).not.toHaveBeenCalled();
  });

  it('prefers stale over an empty upstream result once cooldown ends', async () => {
    fetchHistoryWithFallback.mockResolvedValueOnce([point('2026-01-01', 150)]);
    const mod = await loadModule();

    await mod.getCachedHistory('AAPL', 30);
    vi.advanceTimersByTime(31 * 60_000);
    fetchHistoryWithFallback.mockResolvedValueOnce([]);

    const result = await mod.getCachedHistory('AAPL', 30);
    expect(result).toEqual([point('2026-01-01', 150)]);
  });

  it('drops stale entries after 24 hours', async () => {
    fetchHistoryWithFallback.mockResolvedValueOnce([point('2026-01-01', 150)]);
    const mod = await loadModule();

    await mod.getCachedHistory('AAPL', 30);
    vi.advanceTimersByTime(25 * 60 * 60_000); // past 24h stale TTL
    fetchHistoryWithFallback.mockRejectedValueOnce(new Error('down'));

    const result = await mod.getCachedHistory('AAPL', 30);
    expect(result).toEqual([]);
  });
});
