import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SectorCacheModule from '@/src/lib/sector-cache';

type SectorCache = typeof SectorCacheModule;

const { quoteSummary } = vi.hoisted(() => ({
  quoteSummary: vi.fn<(symbol: string, opts: unknown) => Promise<unknown>>(),
}));

vi.mock('@/src/lib/yahoo-finance-instance', () => ({
  default: {
    quoteSummary: (symbol: string, opts: unknown) => quoteSummary(symbol, opts),
  },
}));

async function loadModule(): Promise<SectorCache> {
  vi.resetModules();
  return import('@/src/lib/sector-cache');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  quoteSummary.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getSectors — fresh / upstream fetch', () => {
  it('fetches upstream on a cold cache', async () => {
    quoteSummary.mockResolvedValueOnce({ assetProfile: { sector: 'Technology' } });
    const mod = await loadModule();

    const result = await mod.getSectors(['AAPL']);

    expect(result).toEqual({ AAPL: 'Technology' });
    expect(quoteSummary).toHaveBeenCalledWith('AAPL', { modules: ['assetProfile'] });
  });

  it('serves from cache within the 24-hour fresh TTL', async () => {
    quoteSummary.mockResolvedValueOnce({ assetProfile: { sector: 'Technology' } });
    const mod = await loadModule();

    await mod.getSectors(['AAPL']);
    vi.advanceTimersByTime(23 * 60 * 60_000);
    await mod.getSectors(['AAPL']);

    expect(quoteSummary).toHaveBeenCalledTimes(1);
  });

  it('normalizes the symbol (trim, upper, dedupe) before fetching', async () => {
    quoteSummary.mockResolvedValue({ assetProfile: { sector: 'Technology' } });
    const mod = await loadModule();

    await mod.getSectors([' aapl ', 'AAPL']);

    expect(quoteSummary).toHaveBeenCalledTimes(1);
    expect(quoteSummary).toHaveBeenCalledWith('AAPL', { modules: ['assetProfile'] });
  });

  it('returns null when Yahoo has no sector on the profile', async () => {
    quoteSummary.mockResolvedValueOnce({ assetProfile: {} });
    const mod = await loadModule();

    const result = await mod.getSectors(['AAPL']);
    expect(result).toEqual({ AAPL: null });
  });
});

describe('getSectors — cooldown & stale-while-error', () => {
  it('enters cooldown after an upstream error', async () => {
    quoteSummary.mockRejectedValueOnce(new Error('Yahoo 429'));
    const mod = await loadModule();

    await mod.getSectors(['AAPL']);

    expect(mod.isSectorUpstreamCoolingDown()).toBe(true);
  });

  it('returns stale sector when upstream errors after the fresh window', async () => {
    quoteSummary.mockResolvedValueOnce({ assetProfile: { sector: 'Technology' } });
    const mod = await loadModule();

    await mod.getSectors(['AAPL']);
    vi.advanceTimersByTime(25 * 60 * 60_000); // past fresh TTL, inside stale TTL
    quoteSummary.mockRejectedValueOnce(new Error('Yahoo 429'));

    const result = await mod.getSectors(['AAPL']);
    expect(result).toEqual({ AAPL: 'Technology' });
  });

  it('skips upstream during cooldown even for new symbols', async () => {
    quoteSummary.mockRejectedValueOnce(new Error('down'));
    const mod = await loadModule();

    await mod.getSectors(['AAPL']); // first-time error → cooldown
    expect(mod.isSectorUpstreamCoolingDown()).toBe(true);

    quoteSummary.mockClear();
    const result = await mod.getSectors(['MSFT', 'GOOGL']);

    expect(quoteSummary).not.toHaveBeenCalled();
    expect(result).toEqual({ MSFT: null, GOOGL: null });
  });

  it('does not escalate the cooldown when a burst of parallel errors all fail at once', async () => {
    // Four parallel 429s from one page load should count as ONE cooldown, not
    // four doublings to the 30-minute cap.
    quoteSummary.mockRejectedValue(new Error('Yahoo 429'));
    const mod = await loadModule();

    await mod.getSectors(['AAPL', 'MSFT', 'GOOGL', 'NVDA']);
    expect(mod.isSectorUpstreamCoolingDown()).toBe(true);

    // After 5 min + 1ms the cooldown should be over — this verifies the
    // cooldown was only set to 5 min (initial), not escalated.
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(mod.isSectorUpstreamCoolingDown()).toBe(false);
  });

  it('drops stale entries older than the 7-day window', async () => {
    quoteSummary.mockResolvedValueOnce({ assetProfile: { sector: 'Technology' } });
    const mod = await loadModule();

    await mod.getSectors(['AAPL']);
    vi.advanceTimersByTime(8 * 24 * 60 * 60_000); // past 7-day stale TTL
    quoteSummary.mockRejectedValueOnce(new Error('down'));

    const result = await mod.getSectors(['AAPL']);
    expect(result).toEqual({ AAPL: null });
  });
});
