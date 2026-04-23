import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TransactionView } from '@/src/lib/transactions';

export type TransactionViewClient = TransactionView;

export interface TransactionInput {
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  fee?: number;
  currency?: string;
  executedAt: string;
  notes?: string;
  portfolioId?: string;
}

export interface TransactionPatch {
  id: string;
  shares?: number;
  price?: number;
  fee?: number;
  currency?: string;
  executedAt?: string;
  notes?: string;
  type?: 'BUY' | 'SELL';
}

interface UseTransactionsArgs {
  symbol?: string;
  portfolioId?: string;
  enabled?: boolean;
}

const BASE_KEY = ['transactions'] as const;

function buildUrl({ symbol, portfolioId }: Omit<UseTransactionsArgs, 'enabled'>) {
  const params = new URLSearchParams();
  if (symbol) params.set('symbol', symbol);
  if (portfolioId) params.set('portfolioId', portfolioId);
  const qs = params.toString();
  return qs ? `/api/transactions?${qs}` : '/api/transactions';
}

async function fetchTransactions(
  args: Omit<UseTransactionsArgs, 'enabled'>,
): Promise<TransactionViewClient[]> {
  const res = await fetch(buildUrl(args));
  if (!res.ok) throw new Error('Failed to load transactions');
  const data = (await res.json()) as { transactions: TransactionViewClient[] };
  return data.transactions;
}

export function useTransactions(args: UseTransactionsArgs = {}) {
  const { symbol, portfolioId, enabled = true } = args;
  return useQuery({
    queryKey: [...BASE_KEY, { symbol: symbol ?? null, portfolioId: portfolioId ?? null }] as const,
    queryFn: () =>
      fetchTransactions({
        ...(symbol ? { symbol } : {}),
        ...(portfolioId ? { portfolioId } : {}),
      }),
    enabled,
    staleTime: 30_000,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['portfolio'] });
  void qc.invalidateQueries({ queryKey: ['portfolio-analytics'] });
  void qc.invalidateQueries({ queryKey: BASE_KEY });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to record transaction');
      return (await res.json()) as { transaction: TransactionViewClient };
    },
    onSuccess: () => invalidateAll(qc),
    meta: {
      successMessage: 'Transaction recorded',
      errorMessage: 'Could not record transaction',
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: TransactionPatch) => {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update transaction');
    },
    onSuccess: () => invalidateAll(qc),
    meta: {
      successMessage: 'Transaction updated',
      errorMessage: 'Could not update transaction',
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete transaction');
    },
    onSuccess: () => invalidateAll(qc),
    meta: {
      successMessage: 'Transaction removed',
      errorMessage: 'Could not remove transaction',
    },
  });
}
