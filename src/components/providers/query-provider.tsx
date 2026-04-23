'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { toast } from 'sonner';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error, _vars, _context, mutation) => {
            // Skip if the mutation opted out via meta.silent.
            if (mutation.meta?.silent) return;
            const message =
              (mutation.meta?.errorMessage as string | undefined) ??
              (error instanceof Error ? error.message : 'Something went wrong');
            toast.error(message);
          },
          onSuccess: (_data, _vars, _context, mutation) => {
            const successMessage = mutation.meta?.successMessage as string | undefined;
            if (successMessage) toast.success(successMessage);
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            gcTime: 1000 * 60 * 10,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
