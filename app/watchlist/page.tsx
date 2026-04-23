'use client';

import { Star, Trash2, TrendingUp, TrendingDown } from 'lucide-react';

import { AddSymbolForm } from '@/src/components/add-symbol-form';
import { Navigation } from '@/src/components/navigation';
import { StockCard } from '@/src/components/stock-card';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useAddToWatchlist, useRemoveFromWatchlist, useWatchlist } from '@/src/hooks/useWatchlist';
import { formatNumber } from '@/src/lib/utils';

export default function WatchlistPage() {
  const { data: watchlist = [], isLoading, error } = useWatchlist();
  const addWatchlist = useAddToWatchlist();
  const removeWatchlist = useRemoveFromWatchlist();

  const priced = watchlist.filter((item) => item.quote !== null);
  const totalMarketCap = priced.reduce((sum, item) => sum + (item.quote?.marketCap ?? 0), 0);
  const gainers = priced.filter((item) => (item.quote?.change ?? 0) > 0).length;
  const losers = priced.filter((item) => (item.quote?.change ?? 0) < 0).length;

  return (
    <div className="bg-background min-h-screen">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-foreground mb-2 text-3xl font-bold">Watchlist</h1>
              <p className="text-muted-foreground">
                Track your favorite stocks and stay updated with market movements.
              </p>
            </div>
            <AddSymbolForm
              onSubmit={(symbol) => addWatchlist.mutateAsync(symbol)}
              placeholder="Add symbol (e.g. AAPL)"
              submitLabel="Add"
            />
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stocks</CardTitle>
              <Star className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">{watchlist.length}</div>
              <p className="text-muted-foreground text-xs">Stocks in watchlist</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Market Cap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {totalMarketCap > 0 ? `$${formatNumber(totalMarketCap)}` : '—'}
              </div>
              <p className="text-muted-foreground text-xs">Combined market cap</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gainers</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {gainers}
              </div>
              <p className="text-muted-foreground text-xs">Stocks in positive territory</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Losers</CardTitle>
              <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{losers}</div>
              <p className="text-muted-foreground text-xs">Stocks in negative territory</p>
            </CardContent>
          </Card>
        </div>

        {error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-lg border p-4">
            Error loading your watchlist. Please try again.
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="h-40 animate-pulse" />
            ))}
          </div>
        ) : watchlist.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {watchlist.map((item) => {
              const quote = item.quote;
              return (
                <div key={item.id} className="relative">
                  <StockCard
                    symbol={item.symbol}
                    name={quote?.name ?? item.symbol}
                    currentPrice={quote?.currentPrice ?? 0}
                    change={quote?.change ?? 0}
                    changePercent={quote?.changePercent ?? 0}
                    marketCap={quote?.marketCap}
                    volume={quote?.volume}
                    isInWatchlist
                    onRemoveFromWatchlist={(symbol) => removeWatchlist.mutate(symbol)}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 h-8 w-8 p-1"
                    onClick={() => removeWatchlist.mutate(item.symbol)}
                    aria-label={`Remove ${item.symbol} from watchlist`}
                    disabled={removeWatchlist.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Star className="text-muted-foreground/60 mx-auto mb-4 h-12 w-12" />
              <h3 className="text-foreground mb-2 text-lg font-medium">Your watchlist is empty</h3>
              <p className="text-muted-foreground mb-4">
                Start building your watchlist by adding stocks you want to track.
              </p>
              <div className="flex justify-center">
                <AddSymbolForm
                  onSubmit={(symbol) => addWatchlist.mutateAsync(symbol)}
                  placeholder="e.g. AAPL"
                  submitLabel="Add to Watchlist"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
