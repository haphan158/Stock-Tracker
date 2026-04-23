import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ProvidersIndex from '@/src/lib/providers';
import type { QuoteProvider, SymbolMatch } from '@/src/lib/providers/types';
import type { StockData } from '@/src/lib/stock-service';

type ProvidersModule = typeof ProvidersIndex;

const { yahoo, finnhub, twelveData } = vi.hoisted(() => {
  const makeProvider = (name: string) =>
    ({
      name,
      isEnabled: vi.fn<() => boolean>(() => true),
      getQuotes: vi.fn<(symbols: string[]) => Promise<StockData[]>>(),
      searchSymbols: vi.fn<(query: string) => Promise<SymbolMatch[]>>(),
      getHistory: vi.fn(),
    }) as unknown as QuoteProvider & {
      isEnabled: ReturnType<typeof vi.fn>;
      getQuotes: ReturnType<typeof vi.fn>;
      searchSymbols: ReturnType<typeof vi.fn>;
      getHistory: ReturnType<typeof vi.fn>;
    };
  return {
    yahoo: makeProvider('yahoo'),
    finnhub: makeProvider('finnhub'),
    twelveData: makeProvider('twelve-data'),
  };
});

vi.mock('@/src/lib/providers/yahoo', () => ({ yahooProvider: yahoo }));
vi.mock('@/src/lib/providers/finnhub', () => ({ finnhubProvider: finnhub }));
vi.mock('@/src/lib/providers/twelve-data', () => ({ twelveDataProvider: twelveData }));

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

async function load(): Promise<ProvidersModule> {
  vi.resetModules();
  return import('@/src/lib/providers');
}

beforeEach(() => {
  // Freeze time so quote(...) instances built at different call sites share
  // the same lastUpdated and deep-equal cleanly.
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  yahoo.isEnabled.mockReset().mockReturnValue(true);
  finnhub.isEnabled.mockReset().mockReturnValue(true);
  twelveData.isEnabled.mockReset().mockReturnValue(true);
  yahoo.getQuotes.mockReset();
  finnhub.getQuotes.mockReset();
  twelveData.getQuotes.mockReset();
  yahoo.searchSymbols.mockReset();
  finnhub.searchSymbols.mockReset();
  yahoo.getHistory.mockReset();
  finnhub.getHistory.mockReset();
  twelveData.getHistory.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchQuotesWithFallback', () => {
  it('returns Yahoo quotes when Yahoo covers every symbol', async () => {
    yahoo.getQuotes.mockResolvedValueOnce([quote('AAPL'), quote('MSFT')]);
    const mod = await load();

    const result = await mod.fetchQuotesWithFallback(['AAPL', 'MSFT']);

    expect(result.map((s) => s.symbol).sort()).toEqual(['AAPL', 'MSFT']);
    expect(yahoo.getQuotes).toHaveBeenCalledTimes(1);
    expect(finnhub.getQuotes).not.toHaveBeenCalled();
  });

  it('falls through to Finnhub for symbols Yahoo did not cover (Yahoo empty → Finnhub fills)', async () => {
    yahoo.getQuotes.mockResolvedValueOnce([]); // Yahoo returns nothing
    finnhub.getQuotes.mockResolvedValueOnce([quote('AAPL', 150), quote('MSFT', 300)]);
    const mod = await load();

    const result = await mod.fetchQuotesWithFallback(['AAPL', 'MSFT']);

    expect(result.map((s) => s.symbol).sort()).toEqual(['AAPL', 'MSFT']);
    expect(yahoo.getQuotes).toHaveBeenCalledWith(['AAPL', 'MSFT']);
    expect(finnhub.getQuotes).toHaveBeenCalledWith(['AAPL', 'MSFT']);
  });

  it('asks Finnhub only for symbols Yahoo missed (partial fill)', async () => {
    yahoo.getQuotes.mockResolvedValueOnce([quote('AAPL', 150)]);
    finnhub.getQuotes.mockResolvedValueOnce([quote('MSFT', 300)]);
    const mod = await load();

    const result = await mod.fetchQuotesWithFallback(['AAPL', 'MSFT']);

    expect(result.map((s) => s.symbol).sort()).toEqual(['AAPL', 'MSFT']);
    expect(yahoo.getQuotes).toHaveBeenCalledWith(['AAPL', 'MSFT']);
    expect(finnhub.getQuotes).toHaveBeenCalledWith(['MSFT']);
  });

  it('does not hit Finnhub when Yahoo threw — oh wait, it does (fallback on error)', async () => {
    yahoo.getQuotes.mockRejectedValueOnce(new Error('yahoo 429'));
    finnhub.getQuotes.mockResolvedValueOnce([quote('AAPL', 150)]);
    const mod = await load();

    const result = await mod.fetchQuotesWithFallback(['AAPL']);

    expect(result).toEqual([quote('AAPL', 150)]);
    expect(finnhub.getQuotes).toHaveBeenCalledWith(['AAPL']);
  });

  it('propagates the last error when every provider throws and nothing was collected', async () => {
    yahoo.getQuotes.mockRejectedValueOnce(new Error('yahoo down'));
    finnhub.getQuotes.mockRejectedValueOnce(new Error('finnhub down'));
    const mod = await load();

    await expect(mod.fetchQuotesWithFallback(['AAPL'])).rejects.toThrow('finnhub down');
  });

  it('wraps a non-Error thrown value into an Error', async () => {
    yahoo.getQuotes.mockRejectedValueOnce('string failure');
    finnhub.getQuotes.mockRejectedValueOnce('another string');
    const mod = await load();

    await expect(mod.fetchQuotesWithFallback(['AAPL'])).rejects.toBeInstanceOf(Error);
  });

  it('does NOT throw when one provider errors but the other returned data', async () => {
    yahoo.getQuotes.mockResolvedValueOnce([quote('AAPL', 150)]);
    finnhub.getQuotes.mockRejectedValueOnce(new Error('finnhub down'));
    const mod = await load();

    // Everything Yahoo covered is returned; Finnhub isn't needed.
    const result = await mod.fetchQuotesWithFallback(['AAPL']);
    expect(result).toEqual([quote('AAPL', 150)]);
  });

  it('returns [] when no providers are enabled', async () => {
    yahoo.isEnabled.mockReturnValue(false);
    finnhub.isEnabled.mockReturnValue(false);
    const mod = await load();

    const result = await mod.fetchQuotesWithFallback(['AAPL']);
    expect(result).toEqual([]);
    expect(yahoo.getQuotes).not.toHaveBeenCalled();
    expect(finnhub.getQuotes).not.toHaveBeenCalled();
  });

  it('normalizes input symbols (trim, upper, dedupe) before delegating', async () => {
    yahoo.getQuotes.mockResolvedValueOnce([quote('AAPL')]);
    const mod = await load();

    await mod.fetchQuotesWithFallback([' aapl ', 'AAPL', '']);
    expect(yahoo.getQuotes).toHaveBeenCalledWith(['AAPL']);
  });
});

describe('searchSymbolsWithFallback', () => {
  it('short-circuits on the first non-empty provider result (does not call Finnhub)', async () => {
    yahoo.searchSymbols.mockResolvedValueOnce([{ symbol: 'AAPL', name: 'Apple' }]);
    finnhub.searchSymbols.mockResolvedValueOnce([{ symbol: 'WRONG', name: 'Wrong' }]);
    const mod = await load();

    const result = await mod.searchSymbolsWithFallback('apple');

    expect(result).toEqual([{ symbol: 'AAPL', name: 'Apple' }]);
    expect(yahoo.searchSymbols).toHaveBeenCalledWith('apple');
    expect(finnhub.searchSymbols).not.toHaveBeenCalled();
  });

  it('falls through to Finnhub when Yahoo returns an empty array', async () => {
    yahoo.searchSymbols.mockResolvedValueOnce([]);
    finnhub.searchSymbols.mockResolvedValueOnce([{ symbol: 'AAPL', name: 'Apple' }]);
    const mod = await load();

    const result = await mod.searchSymbolsWithFallback('apple');

    expect(result).toEqual([{ symbol: 'AAPL', name: 'Apple' }]);
    expect(finnhub.searchSymbols).toHaveBeenCalled();
  });

  it('swallows per-provider errors and tries the next', async () => {
    yahoo.searchSymbols.mockRejectedValueOnce(new Error('yahoo 500'));
    finnhub.searchSymbols.mockResolvedValueOnce([{ symbol: 'AAPL', name: 'Apple' }]);
    const mod = await load();

    const result = await mod.searchSymbolsWithFallback('apple');
    expect(result).toEqual([{ symbol: 'AAPL', name: 'Apple' }]);
  });

  it('returns [] when every provider errors (does NOT propagate)', async () => {
    yahoo.searchSymbols.mockRejectedValueOnce(new Error('yahoo down'));
    finnhub.searchSymbols.mockRejectedValueOnce(new Error('finnhub down'));
    const mod = await load();

    const result = await mod.searchSymbolsWithFallback('apple');
    expect(result).toEqual([]);
  });

  it('returns [] for an empty query without calling any provider', async () => {
    const mod = await load();
    const result = await mod.searchSymbolsWithFallback('   ');
    expect(result).toEqual([]);
    expect(yahoo.searchSymbols).not.toHaveBeenCalled();
    expect(finnhub.searchSymbols).not.toHaveBeenCalled();
  });

  it('trims whitespace off the query before calling providers', async () => {
    yahoo.searchSymbols.mockResolvedValueOnce([{ symbol: 'AAPL', name: 'Apple' }]);
    const mod = await load();

    await mod.searchSymbolsWithFallback('  apple  ');
    expect(yahoo.searchSymbols).toHaveBeenCalledWith('apple');
  });
});

describe('fetchHistoryWithFallback', () => {
  const point = { date: new Date('2026-01-01T00:00:00Z'), close: 150 };

  it('returns Yahoo history when Yahoo has data (no Twelve Data call)', async () => {
    yahoo.getHistory.mockResolvedValueOnce([point]);
    const mod = await load();

    const result = await mod.fetchHistoryWithFallback('AAPL', 30);

    expect(result).toEqual([point]);
    expect(yahoo.getHistory).toHaveBeenCalledWith('AAPL', 30);
    expect(twelveData.getHistory).not.toHaveBeenCalled();
  });

  it('falls through to Twelve Data when Yahoo returns empty', async () => {
    yahoo.getHistory.mockResolvedValueOnce([]);
    twelveData.getHistory.mockResolvedValueOnce([point]);
    const mod = await load();

    const result = await mod.fetchHistoryWithFallback('AAPL', 30);

    expect(result).toEqual([point]);
    expect(twelveData.getHistory).toHaveBeenCalledWith('AAPL', 30);
  });

  it('falls through to Twelve Data when Yahoo throws', async () => {
    yahoo.getHistory.mockRejectedValueOnce(new Error('yahoo 429'));
    twelveData.getHistory.mockResolvedValueOnce([point]);
    const mod = await load();

    const result = await mod.fetchHistoryWithFallback('AAPL', 30);
    expect(result).toEqual([point]);
  });

  it('does NOT call Finnhub for history (Finnhub removed from history chain)', async () => {
    yahoo.getHistory.mockResolvedValueOnce([]);
    twelveData.getHistory.mockResolvedValueOnce([]);
    const mod = await load();

    await mod.fetchHistoryWithFallback('AAPL', 30);
    expect(finnhub.getHistory).not.toHaveBeenCalled();
  });

  it('propagates the last error when every history provider throws', async () => {
    yahoo.getHistory.mockRejectedValueOnce(new Error('yahoo down'));
    twelveData.getHistory.mockRejectedValueOnce(new Error('twelve-data down'));
    const mod = await load();

    await expect(mod.fetchHistoryWithFallback('AAPL', 30)).rejects.toThrow('twelve-data down');
  });

  it('returns [] when no history providers are enabled', async () => {
    yahoo.isEnabled.mockReturnValue(false);
    twelveData.isEnabled.mockReturnValue(false);
    const mod = await load();

    const result = await mod.fetchHistoryWithFallback('AAPL', 30);
    expect(result).toEqual([]);
    expect(yahoo.getHistory).not.toHaveBeenCalled();
    expect(twelveData.getHistory).not.toHaveBeenCalled();
  });
});

describe('getEnabledProviderNames', () => {
  it('lists providers in chain order, filtered by isEnabled', async () => {
    yahoo.isEnabled.mockReturnValue(true);
    finnhub.isEnabled.mockReturnValue(false);
    const mod = await load();
    expect(mod.getEnabledProviderNames()).toEqual(['yahoo']);
  });

  it('returns both names when both providers are enabled', async () => {
    const mod = await load();
    expect(mod.getEnabledProviderNames()).toEqual(['yahoo', 'finnhub']);
  });
});
