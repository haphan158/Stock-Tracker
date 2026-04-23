'use client';

import { useEffect } from 'react';

import { Button } from '@/src/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error] boundary caught:', error);
  }, [error]);

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="bg-card border-border w-full max-w-md rounded-lg border p-6 text-center shadow-sm">
        <h1 className="text-foreground mb-2 text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mb-4 text-sm">
          An unexpected error happened while loading this page. You can try again, or head back to
          the dashboard.
        </p>
        {process.env.NODE_ENV !== 'production' && error?.message ? (
          <pre className="text-destructive bg-destructive/10 border-destructive/20 mb-4 overflow-auto rounded border p-3 text-left text-xs">
            {error.message}
          </pre>
        ) : null}
        <div className="flex justify-center gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
