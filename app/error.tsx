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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-lg p-6 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-600 mb-4">
          An unexpected error happened while loading this page. You can try again, or head back
          to the dashboard.
        </p>
        {process.env.NODE_ENV !== 'production' && error?.message ? (
          <pre className="text-left text-xs text-red-600 bg-red-50 border border-red-100 rounded p-3 mb-4 overflow-auto">
            {error.message}
          </pre>
        ) : null}
        <div className="flex gap-2 justify-center">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
