import { useQuery } from '@tanstack/react-query';

export interface SectorSlice {
  sector: string;
  value: number;
  percent: number;
}

export interface PerformancePoint {
  date: string;
  value: number;
}

export interface PortfolioAnalytics {
  days: number;
  sectors: SectorSlice[];
  performance: PerformancePoint[];
}

async function fetchPortfolioAnalytics(days: number): Promise<PortfolioAnalytics> {
  const res = await fetch(`/api/portfolio/analytics?days=${days}`);
  if (!res.ok) throw new Error('Failed to load analytics');
  return (await res.json()) as PortfolioAnalytics;
}

export function usePortfolioAnalytics(days = 90, enabled = true) {
  return useQuery({
    queryKey: ['portfolio-analytics', days],
    queryFn: () => fetchPortfolioAnalytics(days),
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}
