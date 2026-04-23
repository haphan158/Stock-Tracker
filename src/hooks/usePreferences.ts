import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface PreferencesPayload {
  preferences: {
    displayName: string | null;
    displayCurrency: string;
  };
  supportedCurrencies: readonly string[];
}

const KEY = ['preferences'] as const;

export function usePreferences(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch('/api/preferences');
      if (!res.ok) throw new Error('Failed to load preferences');
      return (await res.json()) as PreferencesPayload;
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { displayName?: string | null; displayCurrency?: string }) => {
      const res = await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Failed to update preferences');
      return (await res.json()) as { preferences: PreferencesPayload['preferences'] };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      // Display currency changes require re-computing all portfolio aggregates.
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
      void qc.invalidateQueries({ queryKey: ['portfolio-analytics'] });
    },
    meta: { successMessage: 'Settings saved', errorMessage: 'Could not save settings' },
  });
}
