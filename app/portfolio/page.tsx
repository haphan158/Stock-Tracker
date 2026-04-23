'use client';

import { useState, type FormEvent } from 'react';

import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, X, AlertTriangle } from 'lucide-react';

import { Navigation } from '@/src/components/navigation';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { useDeleteHolding, usePortfolio, useUpsertHolding } from '@/src/hooks/usePortfolio';
import { formatCurrency, formatPercentage } from '@/src/lib/utils';

export default function PortfolioPage() {
  const { data, isLoading, error } = usePortfolio();
  const upsertHolding = useUpsertHolding();
  const deleteHolding = useDeleteHolding();

  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [averageCost, setAverageCost] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const holdings = data?.holdings ?? [];
  const summary = data?.summary;

  const resetForm = () => {
    setSymbol('');
    setShares('');
    setAverageCost('');
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const sym = symbol.trim().toUpperCase();
    const sharesNum = Number(shares);
    const costNum = Number(averageCost);

    if (!/^[A-Z0-9.\-]{1,10}$/.test(sym)) {
      setFormError('Enter a valid symbol');
      return;
    }
    if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
      setFormError('Shares must be a positive number');
      return;
    }
    if (!Number.isFinite(costNum) || costNum < 0) {
      setFormError('Average cost must be zero or greater');
      return;
    }

    try {
      await upsertHolding.mutateAsync({ symbol: sym, shares: sharesNum, averageCost: costNum });
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save holding');
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <Navigation />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground mb-2 text-3xl font-bold">Portfolio</h1>
              <p className="text-muted-foreground">Track your investments and performance.</p>
            </div>
            <Button
              onClick={() => {
                setShowForm((prev) => !prev);
                setFormError(null);
              }}
              className="flex items-center space-x-2"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{showForm ? 'Cancel' : 'Add Stock'}</span>
            </Button>
          </div>
        </div>

        {showForm ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Add or Update Holding</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Input
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value)}
                  placeholder="Symbol (e.g. AAPL)"
                  aria-label="Symbol"
                  className="uppercase"
                />
                <Input
                  value={shares}
                  onChange={(event) => setShares(event.target.value)}
                  placeholder="Shares"
                  inputMode="decimal"
                  aria-label="Shares"
                />
                <Input
                  value={averageCost}
                  onChange={(event) => setAverageCost(event.target.value)}
                  placeholder="Avg cost per share"
                  inputMode="decimal"
                  aria-label="Average cost per share"
                />
                <Button type="submit" disabled={upsertHolding.isPending}>
                  {upsertHolding.isPending ? 'Saving…' : 'Save'}
                </Button>
                {formError ? (
                  <p className="text-destructive text-sm md:col-span-4">{formError}</p>
                ) : null}
                <p className="text-muted-foreground text-xs md:col-span-4">
                  Adding an existing symbol overwrites its shares and average cost.
                </p>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {formatCurrency(summary?.totalValue ?? 0)}
              </div>
              <p className="text-muted-foreground text-xs">Current portfolio value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {formatCurrency(summary?.totalCost ?? 0)}
              </div>
              <p className="text-muted-foreground text-xs">Total amount invested</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gain/Loss</CardTitle>
              {(summary?.totalGainLoss ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  (summary?.totalGainLoss ?? 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(summary?.totalGainLoss ?? 0)}
              </div>
              <p
                className={`text-xs ${
                  (summary?.totalGainLoss ?? 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatPercentage(summary?.totalGainLossPercent ?? 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {summary?.holdingsCount ?? 0}
              </div>
              <p className="text-muted-foreground text-xs">Different stocks</p>
            </CardContent>
          </Card>
        </div>

        {summary && summary.staleCount > 0 ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <div className="font-medium">
                Live prices unavailable for {summary.staleCount} holding
                {summary.staleCount === 1 ? '' : 's'}.
              </div>
              <div className="text-xs opacity-80">
                Yahoo Finance may be rate-limiting your IP. Those rows fall back to your average
                cost so totals stay sane — they are not current market prices. Add a{' '}
                <code className="font-mono">FINNHUB_API_KEY</code> in{' '}
                <code className="font-mono">.env</code> for an automatic fallback.
              </div>
            </div>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Your Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-destructive">Failed to load holdings.</p>
            ) : isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : holdings.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">
                No holdings yet — click{' '}
                <span className="text-foreground font-medium">Add Stock</span> to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {holdings.map((holding) => (
                  <div
                    key={holding.id}
                    className="border-border bg-card/50 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between sm:block">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-foreground font-semibold">{holding.symbol}</h3>
                            {!holding.quoteAvailable ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                                title="Live price unavailable — showing cost basis as a placeholder"
                              >
                                <AlertTriangle className="h-3 w-3" aria-hidden />
                                no live price
                              </span>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground truncate text-sm">{holding.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-mr-2 text-rose-600 hover:bg-rose-500/10 sm:hidden dark:text-rose-400"
                          onClick={() => deleteHolding.mutate(holding.id)}
                          aria-label={`Remove ${holding.symbol} from portfolio`}
                          disabled={deleteHolding.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-muted-foreground mt-2 text-sm">
                        {holding.shares.toLocaleString(undefined, { maximumFractionDigits: 6 })}{' '}
                        shares @ {formatCurrency(holding.averageCost)} avg ·{' '}
                        {holding.quoteAvailable ? (
                          <span className="text-foreground">
                            now {formatCurrency(holding.currentPrice)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">price unavailable</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div className="text-right">
                        <div className="text-foreground font-semibold">
                          {holding.quoteAvailable ? formatCurrency(holding.marketValue) : '—'}
                        </div>
                        <div
                          className={`text-sm ${
                            !holding.quoteAvailable
                              ? 'text-muted-foreground'
                              : holding.gainLoss >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {holding.quoteAvailable
                            ? `${formatCurrency(holding.gainLoss)} (${formatPercentage(holding.gainLossPercent)})`
                            : '—'}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="hidden text-rose-600 hover:bg-rose-500/10 sm:inline-flex dark:text-rose-400"
                        onClick={() => deleteHolding.mutate(holding.id)}
                        aria-label={`Remove ${holding.symbol} from portfolio`}
                        disabled={deleteHolding.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
