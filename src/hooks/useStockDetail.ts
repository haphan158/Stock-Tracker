import { useQuery } from '@tanstack/react-query';

import type { NewsArticle } from '@/src/lib/news-cache';
import type { StockData } from '@/src/lib/stock-service';

export interface HistoricalPointClient {
  date: string;
  close: number;
}

export interface StockHistoryPayload {
  symbol: string;
  days: number;
  points: HistoricalPointClient[];
}

export interface NewsPayload {
  articles: NewsArticle[];
  configured: boolean;
}

export function useStockQuote(symbol: string) {
  return useQuery({
    queryKey: ['stock-detail', symbol],
    queryFn: async (): Promise<StockData> => {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error('Failed to load stock');
      const data = (await res.json()) as { stock: StockData };
      return data.stock;
    },
    enabled: symbol.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useStockHistory(symbol: string, days: number) {
  return useQuery({
    queryKey: ['stock-history', symbol, days],
    queryFn: async (): Promise<StockHistoryPayload> => {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/history?days=${days}`);
      if (!res.ok) throw new Error('Failed to load stock history');
      return (await res.json()) as StockHistoryPayload;
    },
    enabled: symbol.length > 0 && days > 0,
    staleTime: 5 * 60_000,
  });
}

export function useStockNews(symbol: string, enabled = true) {
  return useQuery({
    queryKey: ['stock-news', symbol],
    queryFn: async (): Promise<NewsPayload> => {
      const res = await fetch(`/api/news/${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error('Failed to load news');
      return (await res.json()) as NewsPayload;
    },
    enabled: enabled && symbol.length > 0,
    staleTime: 5 * 60_000,
  });
}
