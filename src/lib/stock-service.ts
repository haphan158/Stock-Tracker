import yahooFinance from 'yahoo-finance2';
import { fetchHistoryWithFallback, fetchQuotesWithFallback } from '@/src/lib/providers';

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

yahooFinance.suppressNotices(['yahooSurvey']);

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
   * Search Yahoo Finance for symbols matching the query, then fetch quotes for
   * the top matches through the provider chain.
   */
  static async searchStocks(query: string): Promise<StockData[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    try {
      const result = await yahooFinance.search(trimmed, { quotesCount: 15, newsCount: 0 });
      const symbols = (result.quotes ?? [])
        .map((q) => (q as { symbol?: string }).symbol)
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
        .slice(0, 15);

      if (symbols.length === 0) return [];
      return await this.getMultipleStocks(symbols);
    } catch (error) {
      console.error('Error searching stocks:', error);
      return [];
    }
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
