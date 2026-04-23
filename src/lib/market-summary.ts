import { getCachedQuotes } from '@/src/lib/quote-cache';
import type { StockData } from '@/src/lib/stock-service';

/**
 * Wider pool for the "Market summary" (gainers / losers / most active) section.
 * Must match the previous inline list in `app/api/stocks/market-summary/route.ts`.
 */
export const MARKET_SUMMARY_SYMBOLS: string[] = [
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

export interface MarketSummaryData {
  gainers: StockData[];
  losers: StockData[];
  mostActive: StockData[];
}

export async function getMarketSummary(): Promise<MarketSummaryData> {
  const stocks = await getCachedQuotes(MARKET_SUMMARY_SYMBOLS);

  const gainers = stocks
    .filter((stock) => stock.change > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);

  const losers = stocks
    .filter((stock) => stock.change < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 5);

  const mostActive = [...stocks].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 5);

  return { gainers, losers, mostActive };
}
