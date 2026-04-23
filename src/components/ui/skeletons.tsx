import { Card, CardContent, CardHeader } from '@/src/components/ui/card';
import { cn } from '@/src/lib/utils';

/**
 * Low-level placeholder. Prefer composing the specific skeletons below — they
 * match the real layout closely enough to avoid layout shift when data lands.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('bg-muted animate-pulse rounded-md', className)} {...props} />;
}

/** Matches the footprint of <StockCard>. */
export function StockCardSkeleton() {
  return (
    <Card aria-hidden>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Grid of StockCardSkeletons for the dashboard and watchlist. */
export function StockCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading stocks"
    >
      {Array.from({ length: count }).map((_, i) => (
        <StockCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading stocks…</span>
    </div>
  );
}

/** Matches a row in the portfolio holdings list. */
export function HoldingRowSkeleton() {
  return (
    <div
      aria-hidden
      className="border-border bg-card/50 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="flex items-center gap-4 sm:justify-end">
        <div className="space-y-2 text-right">
          <Skeleton className="ml-auto h-5 w-24" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="hidden h-8 w-8 rounded-md sm:block" />
      </div>
    </div>
  );
}

/** Stack of HoldingRowSkeletons with accessible loading label. */
export function HoldingListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading holdings">
      {Array.from({ length: count }).map((_, i) => (
        <HoldingRowSkeleton key={i} />
      ))}
      <span className="sr-only">Loading holdings…</span>
    </div>
  );
}
