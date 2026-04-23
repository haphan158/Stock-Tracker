import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { StockData } from '@/src/lib/stock-service';

export interface WatchlistEntry {
  id: string;
  symbol: string;
  createdAt: string;
  quote: StockData | null;
}

const WATCHLIST_KEY = ['watchlist'] as const;

async function fetchWatchlist(): Promise<WatchlistEntry[]> {
  const res = await fetch('/api/watchlist');
  if (!res.ok) throw new Error('Failed to load watchlist');
  const data = (await res.json()) as { watchlist: WatchlistEntry[] };
  return data.watchlist;
}

async function addWatchlist(symbol: string): Promise<void> {
  const res = await fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) throw new Error('Failed to add to watchlist');
}

async function removeWatchlist(symbol: string): Promise<void> {
  const res = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to remove from watchlist');
}

export function useWatchlist(enabled = true) {
  return useQuery({
    queryKey: WATCHLIST_KEY,
    queryFn: fetchWatchlist,
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useAddToWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: WATCHLIST_KEY }),
    meta: {
      successMessage: 'Added to watchlist',
      errorMessage: 'Could not add to watchlist',
    },
  });
}

export function useRemoveFromWatchlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: WATCHLIST_KEY }),
    meta: {
      successMessage: 'Removed from watchlist',
      errorMessage: 'Could not remove from watchlist',
    },
  });
}
