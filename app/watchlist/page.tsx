'use client';

import { Navigation } from '@/src/components/navigation';
import { StockCard } from '@/src/components/stock-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { AddSymbolForm } from '@/src/components/add-symbol-form';
import { Star, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import {
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useWatchlist,
} from '@/src/hooks/useWatchlist';
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
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Watchlist</h1>
              <p className="text-gray-600">
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stocks</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{watchlist.length}</div>
              <p className="text-xs text-gray-500">Stocks in watchlist</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Market Cap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalMarketCap > 0 ? `$${formatNumber(totalMarketCap)}` : '—'}
              </div>
              <p className="text-xs text-gray-500">Combined market cap</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gainers</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{gainers}</div>
              <p className="text-xs text-gray-500">Stocks in positive territory</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Losers</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{losers}</div>
              <p className="text-xs text-gray-500">Stocks in negative territory</p>
            </CardContent>
          </Card>
        </div>

        {error ? (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            Error loading your watchlist. Please try again.
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse h-40" />
            ))}
          </div>
        ) : watchlist.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    className="absolute top-2 right-2 p-1 h-8 w-8"
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
            <CardContent className="text-center py-12">
              <Star className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Your watchlist is empty</h3>
              <p className="text-gray-500 mb-4">
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
