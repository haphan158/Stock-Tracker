'use client';

import { useState, type FormEvent } from 'react';

import { Bell, BellOff, Plus, Trash2, X } from 'lucide-react';

import { Navigation } from '@/src/components/navigation';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { EmptyState } from '@/src/components/ui/empty-state';
import { Input } from '@/src/components/ui/input';
import { useAlerts, useCreateAlert, useDeleteAlert, useUpdateAlert } from '@/src/hooks/useAlerts';
import { formatCurrency } from '@/src/lib/utils';
import { SYMBOL_RE } from '@/src/lib/validators';

export default function AlertsPage() {
  const { data: alerts = [], isLoading, error } = useAlerts();
  const createAlert = useCreateAlert();
  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();

  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [threshold, setThreshold] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setSymbol('');
    setThreshold('');
    setNote('');
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const sym = symbol.trim().toUpperCase();
    const thresholdNum = Number(threshold);
    if (!SYMBOL_RE.test(sym)) {
      setFormError('Enter a valid symbol');
      return;
    }
    if (!Number.isFinite(thresholdNum) || thresholdNum <= 0) {
      setFormError('Threshold must be positive');
      return;
    }
    try {
      await createAlert.mutateAsync({
        symbol: sym,
        direction,
        threshold: thresholdNum,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create alert');
    }
  };

  const activeCount = alerts.filter((a) => a.active).length;
  const triggeredCount = alerts.length - activeCount;

  return (
    <div className="bg-background min-h-screen">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-foreground text-3xl font-bold">Price alerts</h1>
            <p className="text-muted-foreground">
              Get notified when a symbol crosses a price threshold. Triggered alerts auto-pause so
              you don&apos;t get spammed — reactivate them below.
            </p>
          </div>
          <Button
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
            className="flex items-center gap-2"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'New alert'}
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">{alerts.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                Active
              </CardTitle>
              <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {activeCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-xs font-medium uppercase">
                Triggered
              </CardTitle>
              <BellOff className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {triggeredCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {showForm ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>New alert</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="Symbol (e.g. AAPL)"
                  aria-label="Symbol"
                  className="uppercase"
                />
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'ABOVE' | 'BELOW')}
                  aria-label="Direction"
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                >
                  <option value="ABOVE">Above</option>
                  <option value="BELOW">Below</option>
                </select>
                <Input
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  placeholder="Threshold price"
                  aria-label="Threshold"
                  inputMode="decimal"
                />
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optional)"
                  aria-label="Note"
                />
                <Button type="submit" disabled={createAlert.isPending}>
                  {createAlert.isPending ? 'Saving…' : 'Save'}
                </Button>
                {formError ? (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="text-destructive text-sm md:col-span-5"
                  >
                    {formError}
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Your alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-destructive" role="alert" aria-live="polite">
                Failed to load alerts.
              </p>
            ) : isLoading ? (
              <div className="space-y-2" aria-busy="true">
                {[0, 1].map((i) => (
                  <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                tone="emerald"
                title="No alerts yet"
                description="Get a heads-up when a symbol crosses a threshold — for example, alert me when AAPL drops below $180."
                action={
                  <Button
                    onClick={() => {
                      setShowForm(true);
                      setFormError(null);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" /> Create your first alert
                  </Button>
                }
              />
            ) : (
              <ul className="divide-border divide-y">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="text-foreground font-semibold">
                        {alert.symbol}{' '}
                        <span
                          className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            alert.direction === 'ABOVE'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {alert.direction === 'ABOVE' ? '≥' : '≤'}{' '}
                          {formatCurrency(alert.threshold)}
                        </span>
                      </div>
                      {alert.note ? (
                        <p className="text-muted-foreground mt-1 text-sm">{alert.note}</p>
                      ) : null}
                      {alert.lastTriggeredAt ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          Triggered {new Date(alert.lastTriggeredAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={alert.active ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => updateAlert.mutate({ id: alert.id, active: !alert.active })}
                        disabled={updateAlert.isPending}
                        aria-pressed={alert.active}
                      >
                        {alert.active ? 'Pause' : 'Reactivate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAlert.mutate(alert.id)}
                        disabled={deleteAlert.isPending}
                        aria-label={`Delete alert for ${alert.symbol}`}
                        className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
