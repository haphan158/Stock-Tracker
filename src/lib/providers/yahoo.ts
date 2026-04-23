import yahooFinance from 'yahoo-finance2';

import type { HistoricalPoint, QuoteProvider, SymbolMatch } from '@/src/lib/providers/types';
import type { StockData } from '@/src/lib/stock-service';

yahooFinance.suppressNotices(['yahooSurvey']);

type YahooQuote = Awaited<ReturnType<typeof yahooFinance.quote>>;

function toStockData(quote: Extract<YahooQuote, { symbol: string }>): StockData {
  const currentPrice = quote.regularMarketPrice ?? 0;
  const previousClose = quote.regularMarketPreviousClose ?? 0;
  // Prefer Yahoo's canonical change fields; they reconcile with yahoo.com and
  // account for splits/dividends. Fall back to a manual diff only if missing.
  const change =
    typeof quote.regularMarketChange === 'number'
      ? quote.regularMarketChange
      : currentPrice - previousClose;
  const changePercent =
    typeof quote.regularMarketChangePercent === 'number'
      ? quote.regularMarketChangePercent
      : previousClose > 0
        ? (change / previousClose) * 100
        : 0;

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

export const yahooProvider: QuoteProvider = {
  name: 'yahoo',
  isEnabled() {
    return true;
  },
  async getQuotes(symbols) {
    const unique = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()))).filter(Boolean);
    if (unique.length === 0) return [];
    const quotes = await yahooFinance.quote(unique);
    const list = Array.isArray(quotes) ? quotes : [quotes];
    return list
      .filter(
        (q): q is Extract<YahooQuote, { symbol: string }> => !!q && typeof q.symbol === 'string',
      )
      .map(toStockData);
  },
  async searchSymbols(query) {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const result = await yahooFinance.search(trimmed, { quotesCount: 15, newsCount: 0 });
    const quotes = (result.quotes ?? []) as Array<{
      symbol?: string;
      shortname?: string;
      longname?: string;
    }>;
    const matches: SymbolMatch[] = [];
    for (const q of quotes) {
      if (!q.symbol) continue;
      matches.push({
        symbol: q.symbol.toUpperCase(),
        name: q.longname || q.shortname || q.symbol,
      });
    }
    return matches;
  },
  async getHistory(symbol, days) {
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const history = await yahooFinance.historical(symbol, {
      period1,
      period2: new Date(),
      interval: '1d',
    });
    return history
      .filter((row): row is typeof row & { close: number } => typeof row.close === 'number')
      .map<HistoricalPoint>((row) => ({ date: row.date, close: row.close }));
  },
};
