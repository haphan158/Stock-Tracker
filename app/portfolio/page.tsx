'use client';

import { useState, type FormEvent } from 'react';
import { Navigation } from '@/src/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, X } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/src/lib/utils';
import {
  useDeleteHolding,
  usePortfolio,
  useUpsertHolding,
} from '@/src/hooks/usePortfolio';

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
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Portfolio</h1>
              <p className="text-gray-600">Track your investments and performance.</p>
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
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                  <p className="md:col-span-4 text-sm text-red-600">{formError}</p>
                ) : null}
                <p className="md:col-span-4 text-xs text-gray-500">
                  Adding an existing symbol overwrites its shares and average cost.
                </p>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary?.totalValue ?? 0)}</div>
              <p className="text-xs text-gray-500">Current portfolio value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary?.totalCost ?? 0)}</div>
              <p className="text-xs text-gray-500">Total amount invested</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gain/Loss</CardTitle>
              {(summary?.totalGainLoss ?? 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  (summary?.totalGainLoss ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(summary?.totalGainLoss ?? 0)}
              </div>
              <p
                className={`text-xs ${
                  (summary?.totalGainLoss ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
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
              <div className="text-2xl font-bold">{summary?.holdingsCount ?? 0}</div>
              <p className="text-xs text-gray-500">Different stocks</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-red-600">Failed to load holdings.</p>
            ) : isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : holdings.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                No holdings yet — click <span className="font-medium">Add Stock</span> to get started.
              </p>
            ) : (
              <div className="space-y-4">
                {holdings.map((holding) => (
                  <div
                    key={holding.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{holding.symbol}</h3>
                          <p className="text-sm text-gray-600">{holding.name}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-500">
                        {holding.shares.toLocaleString(undefined, { maximumFractionDigits: 6 })}{' '}
                        shares @ {formatCurrency(holding.averageCost)} avg ·{' '}
                        <span className="text-gray-700">
                          now {formatCurrency(holding.currentPrice)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(holding.marketValue)}
                      </div>
                      <div
                        className={`text-sm ${
                          holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(holding.gainLoss)} ({formatPercentage(holding.gainLossPercent)})
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-4 text-red-600 hover:bg-red-50"
                      onClick={() => deleteHolding.mutate(holding.id)}
                      aria-label={`Remove ${holding.symbol} from portfolio`}
                      disabled={deleteHolding.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
