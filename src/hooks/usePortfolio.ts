import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EnrichedHolding, PortfolioSummary } from '@/src/lib/portfolio';

export interface PortfolioPayload {
  portfolio?: { id: string; name: string; isDefault: boolean };
  holdings: EnrichedHolding[];
  summary: PortfolioSummary;
  displayCurrency?: string;
}

export interface HoldingInput {
  symbol: string;
  shares: number;
  averageCost: number;
  currency?: string;
  portfolioId?: string;
}

export interface HoldingPatch {
  id: string;
  shares?: number;
  averageCost?: number;
  currency?: string;
}

function portfolioKey(portfolioId?: string) {
  return portfolioId ? (['portfolio', portfolioId] as const) : (['portfolio'] as const);
}

async function fetchPortfolio(portfolioId?: string): Promise<PortfolioPayload> {
  const url = portfolioId
    ? `/api/portfolio?portfolioId=${encodeURIComponent(portfolioId)}`
    : '/api/portfolio';
  const res = await fetch(url);
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

export function usePortfolio(enabled = true, portfolioId?: string) {
  return useQuery({
    queryKey: portfolioKey(portfolioId),
    queryFn: () => fetchPortfolio(portfolioId),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

function invalidatePortfolio(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['portfolio'] });
  void qc.invalidateQueries({ queryKey: ['portfolio-analytics'] });
  void qc.invalidateQueries({ queryKey: ['transactions'] });
}

export function useUpsertHolding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrUpdateHolding,
    onSuccess: () => invalidatePortfolio(qc),
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
    onSuccess: () => invalidatePortfolio(qc),
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
    onSuccess: () => invalidatePortfolio(qc),
    meta: {
      successMessage: 'Holding removed',
      errorMessage: 'Could not remove holding',
    },
  });
}
