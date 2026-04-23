import {
  fetchHistoryWithFallback,
  fetchQuotesWithFallback,
  searchSymbolsWithFallback,
} from '@/src/lib/providers';

export interface StockData {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  volume?: number;
  previousClose?: number;
  open?: number;
  dayRange?: { low: number; high: number };
  yearRange?: { low: number; high: number };
  peRatio?: number;
  dividendYield?: number;
  lastUpdated: Date;
}

const TICKER_LIKE = /^[A-Za-z0-9][A-Za-z0-9.\-]{0,9}$/;

export class StockService {
  /** Real-time quote for a single symbol, routed through the provider chain. */
  static async getStockData(symbol: string): Promise<StockData> {
    const [stock] = await fetchQuotesWithFallback([symbol]);
    if (!stock) throw new Error(`Failed to fetch stock data for ${symbol}`);
    return stock;
  }

  /** Batched quotes delegated through the provider chain (Yahoo → Finnhub). */
  static async getMultipleStocks(symbols: string[]): Promise<StockData[]> {
    const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
    if (unique.length === 0) return [];
    return fetchQuotesWithFallback(unique);
  }

  /**
   * Resolve a free-text query to quotes. Tries the provider chain's symbol
   * search (Yahoo → Finnhub) first; if both are empty but the query looks
   * like a ticker, fall through to fetching a quote for it directly so power
   * users can still type "AAPL" when search providers are throttled.
   */
  static async searchStocks(query: string): Promise<StockData[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    let matches = await searchSymbolsWithFallback(trimmed);

    if (matches.length === 0 && TICKER_LIKE.test(trimmed)) {
      const upper = trimmed.toUpperCase();
      matches = [{ symbol: upper, name: upper }];
    }

    if (matches.length === 0) return [];

    const symbols = matches.map((m) => m.symbol).slice(0, 15);
    const quotes = await this.getMultipleStocks(symbols);

    // Preserve the order returned by the symbol-search provider so "best
    // match" stays on top even after the quote fan-out reorders things.
    const ranking = new Map(symbols.map((s, i) => [s, i]));
    return quotes.sort(
      (a, b) => (ranking.get(a.symbol) ?? 99) - (ranking.get(b.symbol) ?? 99),
    );
  }

  /** Company-name-prioritized search. */
  static async searchStocksByName(query: string): Promise<StockData[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const stocks = await this.searchStocks(query);
    return [...stocks]
      .sort((a, b) => {
        const aNameMatch = a.name.toLowerCase().includes(normalizedQuery) ? 1 : 0;
        const bNameMatch = b.name.toLowerCase().includes(normalizedQuery) ? 1 : 0;
        if (aNameMatch !== bNameMatch) return bNameMatch - aNameMatch;

        const aSymbolMatch = a.symbol.toLowerCase().includes(normalizedQuery) ? 1 : 0;
        const bSymbolMatch = b.symbol.toLowerCase().includes(normalizedQuery) ? 1 : 0;
        return bSymbolMatch - aSymbolMatch;
      })
      .slice(0, 15);
  }

  /** Historical close prices, routed through the provider chain. */
  static async getHistoricalData(symbol: string, days: number) {
    return fetchHistoryWithFallback(symbol, days);
  }
}
