import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface PortfolioSummaryItem {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

const KEY = ['portfolios'] as const;

export function usePortfolios(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch('/api/portfolios');
      if (!res.ok) throw new Error('Failed to load portfolios');
      const data = (await res.json()) as { portfolios: PortfolioSummaryItem[] };
      return data.portfolios;
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch('/api/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Failed to create portfolio');
      }
      return (await res.json()) as { portfolio: PortfolioSummaryItem };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: 'Portfolio created', errorMessage: 'Could not create portfolio' },
  });
}

export function useRenamePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/portfolios/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to rename portfolio');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: 'Portfolio renamed', errorMessage: 'Could not rename portfolio' },
  });
}

export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/portfolios/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? 'Failed to delete portfolio');
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
    },
    meta: { successMessage: 'Portfolio deleted', errorMessage: 'Could not delete portfolio' },
  });
}
