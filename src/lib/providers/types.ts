import type { StockData } from '@/src/lib/stock-service';

export interface HistoricalPoint {
  date: Date;
  close: number;
}

export interface SymbolMatch {
  symbol: string;
  name: string;
}

/**
 * Common contract implemented by each upstream quote provider so callers can
 * failover transparently without caring where the data came from.
 */
export interface QuoteProvider {
  readonly name: string;
  /** True when the provider is configured and usable. */
  isEnabled(): boolean;
  /** Batched quote fetch. Throws on failure. */
  getQuotes(symbols: string[]): Promise<StockData[]>;
  /** Optional symbol search. Used by the dashboard's search bar. */
  searchSymbols?(query: string): Promise<SymbolMatch[]>;
  /** Optional historical close prices. */
  getHistory?(symbol: string, days: number): Promise<HistoricalPoint[]>;
}
