'use client';

import { use, useMemo, useState, type FormEvent } from 'react';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';

import { Navigation } from '@/src/components/navigation';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import {
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
} from '@/src/hooks/useTransactions';
import { formatCurrency } from '@/src/lib/utils';
import { SYMBOL_RE } from '@/src/lib/validators';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function toLocalDatetimeInputValue(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export default function TransactionsPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: rawSymbol } = use(params);
  const symbol = decodeURIComponent(rawSymbol).trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) notFound();

  const { data: transactions = [], isLoading, error } = useTransactions({ symbol });
  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [executedAt, setExecutedAt] = useState(() => toLocalDatetimeInputValue(new Date()));
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const summary = useMemo(() => {
    let netShares = 0;
    let totalBought = 0;
    let totalSold = 0;
    for (const tx of transactions) {
      if (tx.type === 'BUY') {
        netShares += tx.shares;
        totalBought += tx.shares * tx.price;
      } else {
        netShares -= tx.shares;
        totalSold += tx.shares * tx.price;
      }
    }
    return { netShares, totalBought, totalSold };
  }, [transactions]);

  const resetForm = () => {
    setShares('');
    setPrice('');
    setFee('');
    setNotes('');
    setExecutedAt(toLocalDatetimeInputValue(new Date()));
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const sharesNum = Number(shares);
    const priceNum = Number(price);
    const feeNum = fee ? Number(fee) : undefined;
    if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
      setFormError('Shares must be positive');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setFormError('Price must be zero or greater');
      return;
    }
    if (feeNum !== undefined && (!Number.isFinite(feeNum) || feeNum < 0)) {
      setFormError('Fee must be zero or greater');
      return;
    }
    try {
      const executedDate = new Date(executedAt);
      if (Number.isNaN(executedDate.getTime())) {
        setFormError('Invalid execution date');
        return;
      }
      await createTx.mutateAsync({
        symbol,
        type,
        shares: sharesNum,
        price: priceNum,
        ...(feeNum !== undefined ? { fee: feeNum } : {}),
        executedAt: executedDate.toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record transaction');
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/portfolio"
          className="text-muted-foreground mb-6 inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to portfolio
        </Link>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-3xl font-bold">{symbol} transactions</h1>
            <p className="text-muted-foreground">
              Your buy/sell ledger — we re-derive holdings from this every time you add a row.
            </p>
          </div>
          <Button
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
            className="flex items-center space-x-2"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span>{showForm ? 'Cancel' : 'Add transaction'}</span>
          </Button>
        </div>

        {showForm ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>New transaction</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value as 'BUY' | 'SELL')}
                  aria-label="Type"
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                >
                  <option value="BUY">Buy</option>
                  <option value="SELL">Sell</option>
                </select>
                <Input
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="Shares"
                  aria-label="Shares"
                  inputMode="decimal"
                />
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Price/share"
                  aria-label="Price per share"
                  inputMode="decimal"
                />
                <Input
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  placeholder="Fee (optional)"
                  aria-label="Fee"
                  inputMode="decimal"
                />
                <Input
                  type="datetime-local"
                  value={executedAt}
                  onChange={(e) => setExecutedAt(e.target.value)}
                  aria-label="Executed at"
                />
                <Button type="submit" disabled={createTx.isPending}>
                  {createTx.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes (optional)"
                  aria-label="Notes"
                  className="md:col-span-6"
                />
                {formError ? (
                  <p className="text-destructive text-sm md:col-span-6">{formError}</p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                Net shares
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {summary.netShares.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                Total bought
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {formatCurrency(summary.totalBought)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                Total sold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {formatCurrency(summary.totalSold)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-destructive">Failed to load transactions.</p>
            ) : isLoading ? (
              <div className="space-y-2" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">
                No transactions for {symbol} yet. Click{' '}
                <span className="text-foreground font-medium">Add transaction</span> to start the
                ledger.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 text-left font-medium">Date</th>
                      <th className="py-2 pr-4 text-left font-medium">Type</th>
                      <th className="py-2 pr-4 text-right font-medium">Shares</th>
                      <th className="py-2 pr-4 text-right font-medium">Price</th>
                      <th className="py-2 pr-4 text-right font-medium">Fee</th>
                      <th className="py-2 pr-4 text-right font-medium">Total</th>
                      <th className="py-2" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => {
                      const total = tx.shares * tx.price + (tx.fee ?? 0);
                      return (
                        <tr key={tx.id} className="border-border border-t">
                          <td className="text-foreground py-3 pr-4">{formatDate(tx.executedAt)}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                tx.type === 'BUY'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="text-foreground py-3 pr-4 text-right">
                            {tx.shares.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                          </td>
                          <td className="text-foreground py-3 pr-4 text-right">
                            {formatCurrency(tx.price)}
                          </td>
                          <td className="text-foreground py-3 pr-4 text-right">
                            {tx.fee === null ? '—' : formatCurrency(tx.fee)}
                          </td>
                          <td className="text-foreground py-3 pr-4 text-right font-medium">
                            {formatCurrency(total)}
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTx.mutate(tx.id)}
                              aria-label={`Delete transaction from ${formatDate(tx.executedAt)}`}
                              disabled={deleteTx.isPending}
                              className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
