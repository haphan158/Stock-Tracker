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
  dayRange?: {
    low: number;
    high: number;
  };
  yearRange?: {
    low: number;
    high: number;
  };
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

export class StockService {
  /**
   * Get real-time stock data for a single symbol
   */
  static async getStockData(symbol: string): Promise<StockData> {
    try {
      const quote = await yahooFinance.quote(symbol);
      
      const currentPrice = quote.regularMarketPrice || 0;
      const previousClose = quote.regularMarketPreviousClose || 0;
      const change = currentPrice - previousClose;
      const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

      return {
        symbol: symbol.toUpperCase(),
        name: quote.longName || quote.shortName || symbol,
        currentPrice,
        change,
        changePercent,
        marketCap: quote.marketCap,
        volume: quote.regularMarketVolume,
        previousClose,
        open: quote.regularMarketOpen,
        dayRange: {
          low: quote.regularMarketDayLow || 0,
          high: quote.regularMarketDayHigh || 0,
        },
        yearRange: {
          low: quote.fiftyTwoWeekLow || 0,
          high: quote.fiftyTwoWeekHigh || 0,
        },
        peRatio: quote.trailingPE,
        dividendYield: (quote as any).dividendYield ? (quote as any).dividendYield * 100 : undefined,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error(`Error fetching stock data for ${symbol}:`, error);
      throw new Error(`Failed to fetch stock data for ${symbol}`);
    }
  }

  /**
   * Get stock data for multiple symbols
   */
  static async getMultipleStocks(symbols: string[]): Promise<StockData[]> {
    try {
      const promises = symbols.map(symbol => this.getStockData(symbol));
      const results = await Promise.allSettled(promises);
      
      return results
        .filter((result): result is PromiseFulfilledResult<StockData> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value);
    } catch (error) {
      console.error('Error fetching multiple stocks:', error);
      throw new Error('Failed to fetch stock data');
    }
  }

  /**
   * Search for stocks by name or symbol using multiple strategies
   */
  static async searchStocks(query: string): Promise<StockData[]> {
    try {
      if (!query || query.trim().length < 1) {
        return [];
      }

      const searchQuery = query.trim().toUpperCase();
      const results: StockData[] = [];

      // Strategy 1: Direct symbol lookup (fastest)
      if (searchQuery.length <= 5 && /^[A-Z]+$/.test(searchQuery)) {
        try {
          const stock = await this.getStockData(searchQuery);
          results.push(stock);
        } catch (error) {
          // Symbol not found, continue to other strategies
        }
      }

      // Strategy 2: Try common variations and exchanges
      const variations = this.generateSymbolVariations(searchQuery);
      for (const variation of variations) {
        try {
          const stock = await this.getStockData(variation);
          if (!results.find(r => r.symbol === stock.symbol)) {
            results.push(stock);
          }
        } catch (error) {
          // Continue to next variation
        }
      }

      // Strategy 3: Search by company name patterns
      const namePatterns = this.generateNamePatterns(query);
      for (const pattern of namePatterns) {
        try {
          const stock = await this.getStockData(pattern);
          if (!results.find(r => r.symbol === stock.symbol)) {
            results.push(stock);
          }
        } catch (error) {
          // Continue to next pattern
        }
      }

      // Strategy 4: Try with common exchange suffixes
      const exchangeSuffixes = ['', '.TO', '.V', '.AX', '.L', '.PA', '.F', '.SW', '.MI'];
      for (const suffix of exchangeSuffixes) {
        const symbolWithSuffix = searchQuery + suffix;
        try {
          const stock = await this.getStockData(symbolWithSuffix);
          if (!results.find(r => r.symbol === stock.symbol)) {
            results.push(stock);
          }
        } catch (error) {
          // Continue to next suffix
        }
      }

      // Remove duplicates and limit results for performance
      const uniqueResults = results.filter((stock, index, self) => 
        index === self.findIndex(s => s.symbol === stock.symbol)
      );

      return uniqueResults.slice(0, 15); // Return up to 15 unique results
    } catch (error) {
      console.error('Error searching stocks:', error);
      return [];
    }
  }

  /**
   * Search stocks with company-name prioritization.
   */
  static async searchStocksByName(query: string): Promise<StockData[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const stocks = await this.searchStocks(query);

    return [...stocks]
      .sort((a, b) => {
        const aNameMatch = a.name.toLowerCase().includes(normalizedQuery) ? 1 : 0;
        const bNameMatch = b.name.toLowerCase().includes(normalizedQuery) ? 1 : 0;

        if (aNameMatch !== bNameMatch) {
          return bNameMatch - aNameMatch;
        }

        const aSymbolMatch = a.symbol.toLowerCase().includes(normalizedQuery) ? 1 : 0;
        const bSymbolMatch = b.symbol.toLowerCase().includes(normalizedQuery) ? 1 : 0;

        return bSymbolMatch - aSymbolMatch;
      })
      .slice(0, 15);
  }

  /**
   * Generate symbol variations for better search coverage
   */
  private static generateSymbolVariations(symbol: string): string[] {
    const variations: string[] = [];
    
    // Common variations
    if (symbol.includes('-')) {
      variations.push(symbol.replace('-', ''));
      variations.push(symbol.replace('-', '.'));
    }
    
    if (symbol.includes('.')) {
      variations.push(symbol.replace('.', ''));
      variations.push(symbol.replace('.', '-'));
    }

    // Add common prefixes/suffixes
    if (symbol.length <= 3) {
      variations.push(symbol + 'A');
      variations.push(symbol + 'B');
      variations.push(symbol + '1');
    }

    return variations;
  }

  /**
   * Generate company name patterns for search
   */
  private static generateNamePatterns(companyName: string): string[] {
    const patterns: string[] = [];
    const words = companyName.toUpperCase().split(/\s+/);
    
    if (words.length >= 2) {
      // First letter of each word
      const acronym = words.map(word => word[0]).join('');
      patterns.push(acronym);
      
      // First two letters of first word + first letter of second
      if (words[0].length >= 2) {
        patterns.push(words[0].substring(0, 2) + words[1][0]);
      }
    }
    
    // First 3-4 letters of first word
    if (words[0].length >= 3) {
      patterns.push(words[0].substring(0, 3));
      if (words[0].length >= 4) {
        patterns.push(words[0].substring(0, 4));
      }
    }

    return patterns;
  }

  /**
   * Get historical data for a stock
   */
  static async getHistoricalData(
    symbol: string, 
    period: '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' | '10y' | 'ytd' | 'max' = '1y'
  ) {
    try {
      const history = await yahooFinance.historical(symbol, {
        period1: this.getPeriodDate(period),
        period2: new Date(),
        interval: '1d'
      });
      
      return history.map(row => ({
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

  /**
   * Helper function to get period start date
   */
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

  /**
   * Get market summary data
   */
  static async getMarketSummary(): Promise<{
    gainers: StockData[];
    losers: StockData[];
    mostActive: StockData[];
  }> {
    try {
      const popularStocks = [
        'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'BRK-B',
        'JPM', 'JNJ', 'V', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'PYPL', 'ADBE'
      ];
      
      const allStocks = await this.getMultipleStocks(popularStocks);
      
      const gainers = allStocks
        .filter(stock => stock.change > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 5);
      
      const losers = allStocks
        .filter(stock => stock.change < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 5);
      
      const mostActive = allStocks
        .sort((a, b) => (b.volume || 0) - (a.volume || 0))
        .slice(0, 5);
      
      return { gainers, losers, mostActive };
    } catch (error) {
      console.error('Error fetching market summary:', error);
      throw new Error('Failed to fetch market summary');
    }
  }
}
