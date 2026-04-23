import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EnrichedHolding, PortfolioSummary } from '@/src/lib/portfolio';

export interface PortfolioPayload {
  holdings: EnrichedHolding[];
  summary: PortfolioSummary;
}

export interface HoldingInput {
  symbol: string;
  shares: number;
  averageCost: number;
}

export interface HoldingPatch {
  id: string;
  shares?: number;
  averageCost?: number;
}

const PORTFOLIO_KEY = ['portfolio'] as const;

async function fetchPortfolio(): Promise<PortfolioPayload> {
  const res = await fetch('/api/portfolio');
  if (!res.ok) throw new Error('Failed to load portfolio');
  return (await res.json()) as PortfolioPayload;
}

async function createOrUpdateHolding(input: HoldingInput): Promise<void> {
  const res = await fetch('/api/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to save holding');
}

async function patchHolding({ id, ...body }: HoldingPatch): Promise<void> {
  const res = await fetch(`/api/portfolio/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update holding');
}

async function deleteHolding(id: string): Promise<void> {
  const res = await fetch(`/api/portfolio/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete holding');
}

export function usePortfolio(enabled = true) {
  return useQuery({
    queryKey: PORTFOLIO_KEY,
    queryFn: fetchPortfolio,
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useUpsertHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrUpdateHolding,
    onSuccess: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
    meta: {
      successMessage: 'Holding saved',
      errorMessage: 'Could not save holding',
    },
  });
}

export function useUpdateHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: patchHolding,
    onSuccess: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
    meta: {
      successMessage: 'Holding updated',
      errorMessage: 'Could not update holding',
    },
  });
}

export function useDeleteHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteHolding,
    onSuccess: () => qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
    meta: {
      successMessage: 'Holding removed',
      errorMessage: 'Could not remove holding',
    },
  });
}
