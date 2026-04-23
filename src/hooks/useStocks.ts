import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { MarketSummaryData } from '@/src/lib/market-summary';
import { type StockData } from '@/src/lib/stock-service';

// API functions
const fetchStocks = async (symbols: string[]): Promise<StockData[]> => {
  const response = await fetch(`/api/stocks?symbols=${symbols.join(',')}`);
  if (!response.ok) {
    throw new Error('Failed to fetch stocks');
  }
  const data = await response.json();
  return data.stocks;
};

const searchStocks = async (query: string): Promise<StockData[]> => {
  const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error('Failed to search stocks');
  }
  const data = await response.json();
  return data.stocks;
};

const fetchMarketSummary = async (): Promise<MarketSummaryData> => {
  const response = await fetch('/api/stocks/market-summary');
  if (!response.ok) {
    throw new Error('Failed to fetch market summary');
  }
  return response.json() as Promise<MarketSummaryData>;
};

function sameOrderedSymbols(a: string[], b: string[]) {
  return a.length === b.length && a.every((s, i) => s === b[i]);
}

export interface UseStocksOptions {
  /** Seeded from the RSC so the first paint matches the server fetch. */
  initialStocks?: StockData[] | undefined;
  /** When `symbols` matches this list (same order), `initialStocks` is used. */
  initialSymbolsKey?: string[] | undefined;
}

// Custom hooks
export function useStocks(symbols: string[], options?: UseStocksOptions) {
  const { initialStocks, initialSymbolsKey } = options ?? {};
  const useInitial =
    initialStocks && initialSymbolsKey && sameOrderedSymbols(symbols, initialSymbolsKey);

  return useQuery({
    queryKey: ['stocks', symbols],
    queryFn: () => fetchStocks(symbols),
    enabled: symbols.length > 0,
    initialData: useInitial ? initialStocks : undefined,
    // Server-side cache already serves fresh data for 60s; don't hammer it.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useStockSearch(query: string) {
  return useQuery({
    queryKey: ['stockSearch', query],
    queryFn: () => searchStocks(query),
    enabled: query.trim().length > 0,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useMarketSummary(initialData?: MarketSummaryData) {
  return useQuery({
    queryKey: ['marketSummary'],
    queryFn: fetchMarketSummary,
    initialData,
    refetchInterval: 2 * 60_000,
    staleTime: 60_000,
  });
}

export function useStockData(symbol: string) {
  return useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => fetchStocks([symbol]).then((stocks) => stocks[0]),
    enabled: !!symbol,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// Mutation for refreshing stock data
export function useRefreshStocks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (symbols: string[]) => fetchStocks(symbols),
    onSuccess: (data) => {
      // Update the stocks query cache
      queryClient.setQueryData(['stocks', data.map((s) => s.symbol)], data);

      // Update individual stock caches
      data.forEach((stock) => {
        queryClient.setQueryData(['stock', stock.symbol], stock);
      });
    },
  });
}
