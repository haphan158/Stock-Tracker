import { logger } from '@/src/lib/logger';
import { finnhubProvider } from '@/src/lib/providers/finnhub';
import type { HistoricalPoint, QuoteProvider, SymbolMatch } from '@/src/lib/providers/types';
import { yahooProvider } from '@/src/lib/providers/yahoo';
import type { StockData } from '@/src/lib/stock-service';

/**
 * Last time each provider errored, keyed by provider name. Exposed via
 * getProviderStatus() so /api/health can surface which upstreams are
 * currently healthy without a database round-trip.
 */
const lastErrorAt = new Map<string, Date>();

function recordError(name: string) {
  lastErrorAt.set(name, new Date());
}

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
      recordError(provider.name);
      logger.warn(
        { err: error, provider: provider.name, remainingSymbols: remaining.length },
        `[providers] ${provider.name} quotes failed; trying fallback`,
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
      recordError(provider.name);
      logger.warn(
        { err: error, provider: provider.name, symbol },
        `[providers] ${provider.name} history failed`,
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
      recordError(provider.name);
      logger.warn(
        { err: error, provider: provider.name, query: trimmed },
        `[providers] ${provider.name} search failed`,
      );
    }
  }
  return [];
}

export function getEnabledProviderNames(): string[] {
  return chain().map((p) => p.name);
}

export interface ProviderStatus {
  name: string;
  enabled: boolean;
  lastErrorAt: string | null;
}

/**
 * Snapshot of each provider's current health. `enabled` reflects whether the
 * provider is configured (e.g. Finnhub needs an API key); `lastErrorAt` is
 * the ISO timestamp of the most recent upstream failure recorded by this
 * process, or null if none.
 */
export function getProviderStatus(): ProviderStatus[] {
  return [yahooProvider, finnhubProvider].map((p) => ({
    name: p.name,
    enabled: p.isEnabled(),
    lastErrorAt: lastErrorAt.get(p.name)?.toISOString() ?? null,
  }));
}
