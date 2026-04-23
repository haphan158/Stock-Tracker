import yahooFinance from 'yahoo-finance2';

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

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
}

// Suppress yahoo-finance2's noisy "survey" prompt so it doesn't pollute server logs.
yahooFinance.suppressNotices(['yahooSurvey']);

type YahooQuote = Awaited<ReturnType<typeof yahooFinance.quote>>;

function toStockData(quote: Extract<YahooQuote, { symbol: string }>): StockData {
  const currentPrice = quote.regularMarketPrice ?? 0;
  const previousClose = quote.regularMarketPreviousClose ?? 0;
  const change = currentPrice - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

  const dividendYield =
    typeof (quote as { dividendYield?: number }).dividendYield === 'number'
      ? (quote as { dividendYield?: number }).dividendYield! * 100
      : undefined;

  return {
    symbol: quote.symbol.toUpperCase(),
    name: quote.longName || quote.shortName || quote.symbol,
    currentPrice,
    change,
    changePercent,
    marketCap: quote.marketCap,
    volume: quote.regularMarketVolume,
    previousClose,
    open: quote.regularMarketOpen,
    dayRange: {
      low: quote.regularMarketDayLow ?? 0,
      high: quote.regularMarketDayHigh ?? 0,
    },
    yearRange: {
      low: quote.fiftyTwoWeekLow ?? 0,
      high: quote.fiftyTwoWeekHigh ?? 0,
    },
    peRatio: quote.trailingPE,
    dividendYield,
    lastUpdated: new Date(),
  };
}

export class StockService {
  /** Real-time quote for a single symbol. */
  static async getStockData(symbol: string): Promise<StockData> {
    try {
      const quote = await yahooFinance.quote(symbol);
      return toStockData(quote as Extract<YahooQuote, { symbol: string }>);
    } catch (error) {
      console.error(`Error fetching stock data for ${symbol}:`, error);
      throw new Error(`Failed to fetch stock data for ${symbol}`);
    }
  }

  /** Batched quotes for many symbols in a single upstream call. */
  static async getMultipleStocks(symbols: string[]): Promise<StockData[]> {
    const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
    if (unique.length === 0) return [];

    try {
      const quotes = await yahooFinance.quote(unique);
      const list = Array.isArray(quotes) ? quotes : [quotes];
      return list
        .filter((q): q is Extract<YahooQuote, { symbol: string }> => !!q && typeof q.symbol === 'string')
        .map(toStockData);
    } catch (error) {
      console.error('Error fetching multiple stocks:', error);
      throw new Error('Failed to fetch stock data');
    }
  }

  /**
   * Search Yahoo Finance for symbols matching the query, then fetch quotes for
   * the top matches in a single batched call.
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

  /** Historical data for a stock. */
  static async getHistoricalData(
    symbol: string,
    period:
      | '1d'
      | '5d'
      | '1mo'
      | '3mo'
      | '6mo'
      | '1y'
      | '2y'
      | '5y'
      | '10y'
      | 'ytd'
      | 'max' = '1y',
  ) {
    try {
      const history = await yahooFinance.historical(symbol, {
        period1: this.getPeriodDate(period),
        period2: new Date(),
        interval: '1d',
      });
      return history.map((row) => ({
        date: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      }));
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      throw new Error(`Failed to fetch historical data for ${symbol}`);
    }
  }

  private static getPeriodDate(period: string): Date {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    switch (period) {
      case '1d':
        return new Date(now.getTime() - oneDay);
      case '5d':
        return new Date(now.getTime() - 5 * oneDay);
      case '1mo':
        return new Date(now.getTime() - 30 * oneDay);
      case '3mo':
        return new Date(now.getTime() - 90 * oneDay);
      case '6mo':
        return new Date(now.getTime() - 180 * oneDay);
      case '1y':
        return new Date(now.getTime() - 365 * oneDay);
      case '2y':
        return new Date(now.getTime() - 2 * 365 * oneDay);
      case '5y':
        return new Date(now.getTime() - 5 * 365 * oneDay);
      case '10y':
        return new Date(now.getTime() - 10 * 365 * oneDay);
      case 'ytd':
        return new Date(now.getFullYear(), 0, 1);
      case 'max':
        return new Date(now.getTime() - 20 * 365 * oneDay);
      default:
        return new Date(now.getTime() - 365 * oneDay);
    }
  }

  /** Snapshot of popular symbols, grouped into gainers/losers/mostActive. */
  static async getMarketSummary(): Promise<{
    gainers: StockData[];
    losers: StockData[];
    mostActive: StockData[];
  }> {
    try {
      const popularStocks = [
        'AAPL',
        'GOOGL',
        'MSFT',
        'TSLA',
        'AMZN',
        'NVDA',
        'META',
        'BRK-B',
        'JPM',
        'JNJ',
        'V',
        'PG',
        'UNH',
        'HD',
        'MA',
        'DIS',
        'PYPL',
        'ADBE',
      ];

      const allStocks = await this.getMultipleStocks(popularStocks);

      const gainers = allStocks
        .filter((stock) => stock.change > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 5);

      const losers = allStocks
        .filter((stock) => stock.change < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 5);

      const mostActive = [...allStocks]
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 5);

      return { gainers, losers, mostActive };
    } catch (error) {
      console.error('Error fetching market summary:', error);
      throw new Error('Failed to fetch market summary');
    }
  }
}
