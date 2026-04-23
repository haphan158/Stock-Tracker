'use client';

import { useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Navigation } from '@/src/components/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { usePortfolioAnalytics } from '@/src/hooks/usePortfolioAnalytics';
import { formatPercentage } from '@/src/lib/utils';

const AnalyticsCharts = dynamic(
  () =>
    import('@/src/components/analytics-charts').then((mod) => ({
      default: mod.AnalyticsCharts,
    })),
  {
    ssr: false,
    loading: () => <div className="text-muted-foreground py-12 text-center">Loading charts…</div>,
  },
);

const ALLOCATION_COLORS_LIGHT = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#9333ea',
  '#db2777',
  '#14b8a6',
  '#eab308',
  '#64748b',
];

const ALLOCATION_COLORS_DARK = [
  '#60a5fa',
  '#4ade80',
  '#fb923c',
  '#c084fc',
  '#f472b6',
  '#2dd4bf',
  '#facc15',
  '#94a3b8',
];

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState<number>(90);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const allocationColors = isDark ? ALLOCATION_COLORS_DARK : ALLOCATION_COLORS_LIGHT;
  const gridStroke = isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const primaryAccent = isDark ? '#60a5fa' : '#2563eb';
  const gainColor = isDark ? '#4ade80' : '#16a34a';
  const lossColor = isDark ? '#f87171' : '#dc2626';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: '0.5rem',
    color: isDark ? '#f1f5f9' : '#0f172a',
  };

  const { data, isLoading, error } = usePortfolio();
  const holdings = useMemo(() => data?.holdings ?? [], [data]);
  const summary = data?.summary;

  const analytics = usePortfolioAnalytics(rangeDays, holdings.length > 0);

  const holdingAllocation = useMemo(() => {
    const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    return holdings
      .map((h) => ({
        symbol: h.symbol,
        value: h.marketValue,
        percent: totalValue > 0 ? (h.marketValue / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  const gainLossPerHolding = useMemo(
    () =>
      [...holdings]
        .sort((a, b) => b.gainLossPercent - a.gainLossPercent)
        .map((h) => ({
          symbol: h.symbol,
          gainLoss: h.gainLoss,
          gainLossPercent: Number(h.gainLossPercent.toFixed(2)),
        })),
    [holdings],
  );

  const bestPerformer = gainLossPerHolding[0];
  const worstPerformer =
    gainLossPerHolding.length > 1 ? gainLossPerHolding[gainLossPerHolding.length - 1] : null;

  return (
    <div className="bg-background min-h-screen">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-foreground mb-2 text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            A snapshot of your portfolio performance, computed from your holdings.
          </p>
        </div>

        {error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive mb-6 rounded-lg border p-4">
            Failed to load analytics.
          </div>
        ) : null}

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Return</CardTitle>
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
                {formatPercentage(summary?.totalGainLossPercent ?? 0)}
              </div>
              <p className="text-muted-foreground text-xs">Unrealized P/L across all holdings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Holdings</CardTitle>
              <BarChart3 className="text-primary h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-foreground text-2xl font-bold">
                {summary?.holdingsCount ?? 0}
              </div>
              <p className="text-muted-foreground text-xs">Distinct positions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Best Performer</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {bestPerformer ? `${formatPercentage(bestPerformer.gainLossPercent)}` : '—'}
              </div>
              <p className="text-muted-foreground text-xs">
                {bestPerformer ? bestPerformer.symbol : 'No holdings'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Worst Performer</CardTitle>
              <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                {worstPerformer ? formatPercentage(worstPerformer.gainLossPercent) : '—'}
              </div>
              <p className="text-muted-foreground text-xs">
                {worstPerformer ? worstPerformer.symbol : 'No holdings'}
              </p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center">
              Loading analytics…
            </CardContent>
          </Card>
        ) : holdings.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-12 text-center">
              Add holdings in the Portfolio page to see analytics.
            </CardContent>
          </Card>
        ) : (
          <AnalyticsCharts
            rangeDays={rangeDays}
            onRangeChange={setRangeDays}
            allocationColors={allocationColors}
            gridStroke={gridStroke}
            axisColor={axisColor}
            primaryAccent={primaryAccent}
            gainColor={gainColor}
            lossColor={lossColor}
            tooltipStyle={tooltipStyle}
            holdingAllocation={holdingAllocation}
            gainLossPerHolding={gainLossPerHolding}
            portfolioAnalytics={analytics}
          />
        )}
      </main>
    </div>
  );
}
