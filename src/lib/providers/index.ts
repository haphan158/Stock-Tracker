import { upstreamErrorLogFields } from '@/src/lib/log-upstream';
import { logger } from '@/src/lib/logger';
import { finnhubProvider } from '@/src/lib/providers/finnhub';
import { twelveDataProvider } from '@/src/lib/providers/twelve-data';
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
 * Each capability has its own ordered provider chain. Yahoo is always the
 * primary because it's free and broad; the fallbacks differ per capability:
 *
 *   - quotes:  Yahoo → Finnhub  (Finnhub's /quote still works on free tier)
 *   - search:  Yahoo → Finnhub  (Finnhub's /search still works on free tier)
 *   - history: Yahoo → Twelve Data  (Finnhub removed /stock/candle from free)
 */
function quoteChain(): QuoteProvider[] {
  return [yahooProvider, finnhubProvider].filter(
    (p) => p.isEnabled() && typeof p.getQuotes === 'function',
  );
}

function historyChain(): QuoteProvider[] {
  return [yahooProvider, twelveDataProvider].filter(
    (p) => p.isEnabled() && typeof p.getHistory === 'function',
  );
}

function searchChain(): QuoteProvider[] {
  return [yahooProvider, finnhubProvider].filter(
    (p) => p.isEnabled() && typeof p.searchSymbols === 'function',
  );
}

export async function fetchQuotesWithFallback(symbols: string[]): Promise<StockData[]> {
  const providers = quoteChain();
  if (providers.length === 0) return [];

  const merged = new Map<string, StockData>();
  let remaining = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
  let lastError: unknown;

  for (const provider of providers) {
    if (remaining.length === 0) break;
    try {
      const stocks = await provider.getQuotes!(remaining);
      for (const stock of stocks) merged.set(stock.symbol, stock);
      remaining = remaining.filter((sym) => !merged.has(sym));
    } catch (error) {
      lastError = error;
      recordError(provider.name);
      const fields = upstreamErrorLogFields(error);
      logger.warn(
        { provider: provider.name, remainingSymbols: remaining.length, ...fields },
        fields.rateLimited
          ? `[providers] ${provider.name} rate-limited; trying fallback`
          : `[providers] ${provider.name} quotes failed; trying fallback`,
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
  const providers = historyChain();
  let lastError: unknown;
  for (const provider of providers) {
    try {
      const history = await provider.getHistory!(symbol, days);
      if (history.length > 0) return history;
    } catch (error) {
      lastError = error;
      recordError(provider.name);
      const fields = upstreamErrorLogFields(error);
      logger.warn(
        { provider: provider.name, symbol, ...fields },
        fields.rateLimited
          ? `[providers] ${provider.name} history rate-limited`
          : `[providers] ${provider.name} history failed`,
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

  const providers = searchChain();
  for (const provider of providers) {
    try {
      const matches = await provider.searchSymbols!(trimmed);
      if (matches.length > 0) return matches;
    } catch (error) {
      recordError(provider.name);
      const fields = upstreamErrorLogFields(error);
      logger.warn(
        { provider: provider.name, query: trimmed, ...fields },
        fields.rateLimited
          ? `[providers] ${provider.name} search rate-limited`
          : `[providers] ${provider.name} search failed`,
      );
    }
  }
  return [];
}

export function getEnabledProviderNames(): string[] {
  return quoteChain().map((p) => p.name);
}

export interface ProviderStatus {
  name: string;
  enabled: boolean;
  lastErrorAt: string | null;
}

/**
 * Snapshot of each provider's current health. `enabled` reflects whether the
 * provider is configured (e.g. Finnhub and Twelve Data need API keys);
 * `lastErrorAt` is the ISO timestamp of the most recent upstream failure
 * recorded by this process, or null if none.
 */
export function getProviderStatus(): ProviderStatus[] {
  return [yahooProvider, finnhubProvider, twelveDataProvider].map((p) => ({
    name: p.name,
    enabled: p.isEnabled(),
    lastErrorAt: lastErrorAt.get(p.name)?.toISOString() ?? null,
  }));
}
