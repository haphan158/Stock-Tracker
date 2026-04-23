import type { StockData } from '@/src/lib/stock-service';
import type { HistoricalPoint, QuoteProvider, SymbolMatch } from '@/src/lib/providers/types';
import { yahooProvider } from '@/src/lib/providers/yahoo';
import { finnhubProvider } from '@/src/lib/providers/finnhub';

/**
 * Ordered list of providers. The first one is the primary; later providers are
 * fallbacks used when the primary errors or returns no data for a symbol.
 *
 * The primary is Yahoo (broadest coverage, no key needed). Finnhub is tried
 * next if FINNHUB_API_KEY is set.
 */
function chain(): QuoteProvider[] {
  return [yahooProvider, finnhubProvider].filter((p) => p.isEnabled());
}

export async function fetchQuotesWithFallback(symbols: string[]): Promise<StockData[]> {
  const providers = chain();
  if (providers.length === 0) return [];

  const merged = new Map<string, StockData>();
  let remaining = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
  let lastError: unknown;

  for (const provider of providers) {
    if (remaining.length === 0) break;
    try {
      const stocks = await provider.getQuotes(remaining);
      for (const stock of stocks) merged.set(stock.symbol, stock);
      remaining = remaining.filter((sym) => !merged.has(sym));
    } catch (error) {
      lastError = error;
      console.warn(
        `[providers] ${provider.name} failed (${remaining.length} symbols); trying fallback`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (merged.size === 0 && lastError) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  return Array.from(merged.values());
}

export async function fetchHistoryWithFallback(
  symbol: string,
  days: number,
): Promise<HistoricalPoint[]> {
  const providers = chain().filter((p) => typeof p.getHistory === 'function');
  let lastError: unknown;
  for (const provider of providers) {
    try {
      const history = await provider.getHistory!(symbol, days);
      if (history.length > 0) return history;
    } catch (error) {
      lastError = error;
      console.warn(
        `[providers] ${provider.name} history failed for ${symbol}`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  if (lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));
  return [];
}

/**
 * Try each provider in order; return the first non-empty result. Unlike quotes
 * we don't merge across providers because ranking differs and duplicates are
 * noisy. Errors are swallowed so one rate-limited provider doesn't kill search.
 */
export async function searchSymbolsWithFallback(query: string): Promise<SymbolMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const providers = chain().filter((p) => typeof p.searchSymbols === 'function');
  for (const provider of providers) {
    try {
      const matches = await provider.searchSymbols!(trimmed);
      if (matches.length > 0) return matches;
    } catch (error) {
      console.warn(
        `[providers] ${provider.name} search failed for "${trimmed}"`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return [];
}

export function getEnabledProviderNames(): string[] {
  return chain().map((p) => p.name);
}
