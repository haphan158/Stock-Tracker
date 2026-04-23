'use client';

import { useState, type FormEvent } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  Bell,
  BellOff,
  Briefcase,
  Plus,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { Navigation } from '@/src/components/navigation';
import { NewsList } from '@/src/components/news-list';
import { StockHistoryChart } from '@/src/components/stock-history-chart';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { useCreateAlert } from '@/src/hooks/useAlerts';
import { useStockQuote } from '@/src/hooks/useStockDetail';
import { useCreateTransaction } from '@/src/hooks/useTransactions';
import { useAddToWatchlist, useRemoveFromWatchlist, useWatchlist } from '@/src/hooks/useWatchlist';
import type { StockData } from '@/src/lib/stock-service';
import { formatCurrency, formatNumber, formatPercentage, getChangeColor } from '@/src/lib/utils';

export interface StockDetailClientProps {
  symbol: string;
  initialStock: StockData | null;
}

function formatRatio(value: number | undefined): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

function formatRange(range: { low: number; high: number } | undefined): string {
  if (!range) return '—';
  if (!Number.isFinite(range.low) || !Number.isFinite(range.high)) return '—';
  return `${formatCurrency(range.low)} – ${formatCurrency(range.high)}`;
}

export function StockDetailClient({ symbol, initialStock }: StockDetailClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  const quoteQuery = useStockQuote(symbol);
  const stock = quoteQuery.data ?? initialStock;

  const [rangeDays, setRangeDays] = useState<number>(180);

  const { data: watchlist = [] } = useWatchlist(isAuthenticated);
  const addWatchlist = useAddToWatchlist();
  const removeWatchlist = useRemoveFromWatchlist();
  const isInWatchlist = watchlist.some((w) => w.symbol === symbol);

  const createTransaction = useCreateTransaction();
  const createAlert = useCreateAlert();

  const [showBuyForm, setShowBuyForm] = useState(false);
  const [buyShares, setBuyShares] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyError, setBuyError] = useState<string | null>(null);

  const [showAlertForm, setShowAlertForm] = useState(false);
  const [alertDirection, setAlertDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertError, setAlertError] = useState<string | null>(null);

  const handleWatchlistToggle = () => {
    if (!isAuthenticated) {
      toast.error('Sign in to use the watchlist.');
      return;
    }
    if (isInWatchlist) removeWatchlist.mutate(symbol);
    else addWatchlist.mutate(symbol);
  };

  const handleBuySubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBuyError(null);
    const shares = Number(buyShares);
    const price = Number(buyPrice);
    if (!Number.isFinite(shares) || shares <= 0) {
      setBuyError('Shares must be a positive number');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setBuyError('Price must be zero or greater');
      return;
    }
    try {
      await createTransaction.mutateAsync({
        symbol,
        type: 'BUY',
        shares,
        price,
        executedAt: new Date().toISOString(),
      });
      setBuyShares('');
      setBuyPrice('');
      setShowBuyForm(false);
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Failed to record buy');
    }
  };

  const handleAlertSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAlertError(null);
    const threshold = Number(alertThreshold);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      setAlertError('Threshold must be a positive number');
      return;
    }
    try {
      await createAlert.mutateAsync({ symbol, direction: alertDirection, threshold });
      setAlertThreshold('');
      setShowAlertForm(false);
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : 'Failed to create alert');
    }
  };

  if (!stock && !quoteQuery.isLoading) {
    return (
      <div className="bg-background min-h-screen">
        <Navigation />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground mb-6 inline-flex items-center gap-1 text-sm hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <Card>
            <CardContent className="py-12 text-center">
              <h2 className="text-foreground text-xl font-semibold">{symbol}</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                We couldn&apos;t find a quote for this symbol. It may not exist or Yahoo is rate-
                limiting this IP.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const change = stock?.change ?? 0;
  const changePercent = stock?.changePercent ?? 0;
  const Icon = change >= 0 ? TrendingUp : TrendingDown;
  const iconClass =
    change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="bg-background min-h-screen">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-muted-foreground mb-6 inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        {/* Header block */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-foreground text-3xl font-bold">{symbol}</h1>
              <span className="text-muted-foreground text-lg">{stock?.name}</span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-foreground text-4xl font-bold">
                {stock ? formatCurrency(stock.currentPrice) : '—'}
              </span>
              <span className={`inline-flex items-center gap-1 text-sm ${getChangeColor(change)}`}>
                <Icon className={`h-4 w-4 ${iconClass}`} aria-hidden />
                {formatCurrency(Math.abs(change))} ({formatPercentage(changePercent)})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={isInWatchlist ? 'default' : 'outline'}
              size="sm"
              onClick={handleWatchlistToggle}
              aria-pressed={isInWatchlist}
              className="flex items-center gap-2"
            >
              <Star className={`h-4 w-4 ${isInWatchlist ? 'fill-current' : ''}`} />
              {isInWatchlist ? 'In watchlist' : 'Add to watchlist'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error('Sign in to add holdings.');
                  return;
                }
                setShowBuyForm((v) => !v);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add to portfolio
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error('Sign in to set alerts.');
                  return;
                }
                setShowAlertForm((v) => !v);
              }}
              className="flex items-center gap-2"
            >
              {showAlertForm ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              Set alert
            </Button>
          </div>
        </div>

        {showBuyForm ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Record a buy</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleBuySubmit}
                className="grid grid-cols-1 gap-3 md:grid-cols-4"
                aria-label={`Record a buy for ${symbol}`}
              >
                <Input
                  value={buyShares}
                  onChange={(e) => setBuyShares(e.target.value)}
                  placeholder="Shares"
                  aria-label="Shares"
                  inputMode="decimal"
                />
                <Input
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  placeholder={`Price per share (${stock ? formatCurrency(stock.currentPrice) : '—'})`}
                  aria-label="Price per share"
                  inputMode="decimal"
                />
                <Button type="submit" disabled={createTransaction.isPending}>
                  <Briefcase className="mr-2 h-4 w-4" />
                  {createTransaction.isPending ? 'Saving…' : 'Record buy'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowBuyForm(false)}>
                  Cancel
                </Button>
                {buyError ? (
                  <p className="text-destructive text-sm md:col-span-4">{buyError}</p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        ) : null}

        {showAlertForm ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Price alert</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleAlertSubmit}
                className="grid grid-cols-1 gap-3 md:grid-cols-4"
                aria-label={`Create alert for ${symbol}`}
              >
                <select
                  value={alertDirection}
                  onChange={(e) => setAlertDirection(e.target.value as 'ABOVE' | 'BELOW')}
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                  aria-label="Direction"
                >
                  <option value="ABOVE">Above</option>
                  <option value="BELOW">Below</option>
                </select>
                <Input
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  placeholder="Threshold price"
                  aria-label="Threshold price"
                  inputMode="decimal"
                />
                <Button type="submit" disabled={createAlert.isPending}>
                  {createAlert.isPending ? 'Saving…' : 'Create alert'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowAlertForm(false)}>
                  Cancel
                </Button>
                {alertError ? (
                  <p className="text-destructive text-sm md:col-span-4">{alertError}</p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        ) : null}

        {/* KPI tiles */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                P / E
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {formatRatio(stock?.peRatio)}
              </div>
              <p className="text-muted-foreground text-xs">Trailing price / earnings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {stock?.volume ? formatNumber(stock.volume) : '—'}
              </div>
              <p className="text-muted-foreground text-xs">Shares traded today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                52-week range
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-lg font-semibold">
                {formatRange(stock?.yearRange)}
              </div>
              <p className="text-muted-foreground text-xs">Low – high, trailing year</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                Market cap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {stock?.marketCap ? `$${formatNumber(stock.marketCap)}` : '—'}
              </div>
              <p className="text-muted-foreground text-xs">
                {stock?.dividendYield
                  ? `Dividend yield: ${stock.dividendYield.toFixed(2)}%`
                  : 'No dividend reported'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart + secondary stats row */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StockHistoryChart symbol={symbol} rangeDays={rangeDays} onRangeChange={setRangeDays} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Today</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Open</dt>
                  <dd className="text-foreground font-medium">
                    {stock?.open ? formatCurrency(stock.open) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Previous close</dt>
                  <dd className="text-foreground font-medium">
                    {stock?.previousClose ? formatCurrency(stock.previousClose) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Day range</dt>
                  <dd className="text-foreground font-medium">{formatRange(stock?.dayRange)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last updated</dt>
                  <dd className="text-foreground font-medium">
                    {stock?.lastUpdated ? new Date(stock.lastUpdated).toLocaleTimeString() : '—'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <NewsList symbol={symbol} />
      </main>
    </div>
  );
}
