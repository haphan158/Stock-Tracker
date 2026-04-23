import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StockData } from '@/src/lib/stock-service';

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

const fetchMarketSummary = async () => {
  const response = await fetch('/api/stocks/market-summary');
  if (!response.ok) {
    throw new Error('Failed to fetch market summary');
  }
  return response.json();
};

// Custom hooks
export function useStocks(symbols: string[]) {
  return useQuery({
    queryKey: ['stocks', symbols],
    queryFn: () => fetchStocks(symbols),
    enabled: symbols.length > 0,
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

export function useMarketSummary() {
  return useQuery({
    queryKey: ['marketSummary'],
    queryFn: fetchMarketSummary,
    refetchInterval: 2 * 60_000,
    staleTime: 60_000,
  });
}

export function useStockData(symbol: string) {
  return useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => fetchStocks([symbol]).then(stocks => stocks[0]),
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
      queryClient.setQueryData(['stocks', data.map(s => s.symbol)], data);
      
      // Update individual stock caches
      data.forEach(stock => {
        queryClient.setQueryData(['stock', stock.symbol], stock);
      });
    },
  });
}
