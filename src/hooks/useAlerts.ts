import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface AlertView {
  id: string;
  symbol: string;
  direction: 'ABOVE' | 'BELOW';
  threshold: number;
  active: boolean;
  note: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface AlertInput {
  symbol: string;
  direction: 'ABOVE' | 'BELOW';
  threshold: number;
  note?: string;
  active?: boolean;
}

export interface AlertPatch {
  id: string;
  direction?: 'ABOVE' | 'BELOW';
  threshold?: number;
  note?: string;
  active?: boolean;
}

const KEY = ['alerts'] as const;

export function useAlerts(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error('Failed to load alerts');
      const data = (await res.json()) as { alerts: AlertView[] };
      return data.alerts;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AlertInput) => {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to create alert');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: 'Alert created', errorMessage: 'Could not create alert' },
  });
}

export function useUpdateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: AlertPatch) => {
      const res = await fetch(`/api/alerts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to update alert');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: 'Alert updated', errorMessage: 'Could not update alert' },
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alerts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete alert');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    meta: { successMessage: 'Alert deleted', errorMessage: 'Could not delete alert' },
  });
}
