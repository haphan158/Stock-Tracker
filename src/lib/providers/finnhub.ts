import type { StockData } from '@/src/lib/stock-service';
import type { HistoricalPoint, QuoteProvider, SymbolMatch } from '@/src/lib/providers/types';

const BASE_URL = 'https://finnhub.io/api/v1';
const PROFILE_TTL_MS = 24 * 60 * 60 * 1000; // Finnhub profiles rarely change.

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // change percent
  h: number; // day high
  l: number; // day low
  o: number; // day open
  pc: number; // previous close
  t: number; // unix seconds
}

interface FinnhubProfile {
  name?: string;
  marketCapitalization?: number;
  finnhubIndustry?: string;
}

const profileCache = new Map<string, { profile: FinnhubProfile; fetchedAt: number }>();

function apiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY;
  return key && key.trim().length > 0 ? key : null;
}

async function fetchJson<T>(path: string): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error('Finnhub is not configured');
  const url = `${BASE_URL}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Finnhub ${path} ${res.status}`);
  }
  return (await res.json()) as T;
}

async function getProfile(symbol: string): Promise<FinnhubProfile> {
  const now = Date.now();
  const cached = profileCache.get(symbol);
  if (cached && now - cached.fetchedAt < PROFILE_TTL_MS) {
    return cached.profile;
  }
  const profile = await fetchJson<FinnhubProfile>(
    `/stock/profile2?symbol=${encodeURIComponent(symbol)}`,
  );
  profileCache.set(symbol, { profile, fetchedAt: now });
  return profile;
}

async function getSingleQuote(symbol: string): Promise<StockData | null> {
  const quote = await fetchJson<FinnhubQuote>(`/quote?symbol=${encodeURIComponent(symbol)}`);
  // Finnhub returns all-zeros for unknown symbols — treat as a miss.
  if (!quote || (quote.c === 0 && quote.pc === 0)) return null;

  let profile: FinnhubProfile = {};
  try {
    profile = await getProfile(symbol);
  } catch {
    // Profile is best-effort; we can still return price data without it.
  }

  const marketCap =
    typeof profile.marketCapitalization === 'number'
      ? profile.marketCapitalization * 1_000_000 // Finnhub reports in millions.
      : undefined;

  return {
    symbol: symbol.toUpperCase(),
    name: profile.name || symbol.toUpperCase(),
    currentPrice: quote.c,
    change: quote.d,
    changePercent: quote.dp,
    marketCap,
    previousClose: quote.pc,
    open: quote.o,
    dayRange: { low: quote.l, high: quote.h },
    lastUpdated: new Date(),
  };
}

export const finnhubProvider: QuoteProvider = {
  name: 'finnhub',
  isEnabled() {
    return apiKey() !== null;
  },
  async getQuotes(symbols) {
    const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
    if (unique.length === 0) return [];
    // Finnhub doesn't have a true batch endpoint on the free tier, so we fan
    // out. 60/min free quota is plenty for interactive dashboards.
    const results = await Promise.allSettled(unique.map((s) => getSingleQuote(s)));
    const stocks: StockData[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        stocks.push(result.value);
      }
    }
    return stocks;
  },
  async searchSymbols(query) {
    const trimmed = query.trim();
    if (!trimmed) return [];
    interface FinnhubSearchResult {
      count: number;
      result: Array<{
        symbol?: string;
        displaySymbol?: string;
        description?: string;
        type?: string;
      }>;
    }
    const data = await fetchJson<FinnhubSearchResult>(
      `/search?q=${encodeURIComponent(trimmed)}`,
    );
    const matches: SymbolMatch[] = [];
    const seen = new Set<string>();
    for (const row of data.result ?? []) {
      // Finnhub returns a mix of exchanges for the same company, e.g.
      // AAPL, AAPL.SW, AAPL.MX — prefer plain US symbols (no dot) first.
      const raw = row.displaySymbol || row.symbol;
      if (!raw) continue;
      const symbol = raw.toUpperCase();
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      matches.push({ symbol, name: row.description || symbol });
      if (matches.length >= 15) break;
    }
    return matches;
  },
  async getHistory(symbol, days) {
    const to = Math.floor(Date.now() / 1000);
    const from = to - days * 24 * 60 * 60;
    interface FinnhubCandle {
      s: 'ok' | 'no_data';
      c?: number[];
      t?: number[];
    }
    const candle = await fetchJson<FinnhubCandle>(
      `/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}`,
    );
    if (candle.s !== 'ok' || !candle.c || !candle.t) return [];
    return candle.c.map<HistoricalPoint>((close, i) => ({
      date: new Date((candle.t![i] ?? 0) * 1000),
      close,
    }));
  },
};
