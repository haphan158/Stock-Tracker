'use client';

import { useMemo, useState } from 'react';

import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Navigation } from '@/src/components/navigation';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { usePortfolioAnalytics } from '@/src/hooks/usePortfolioAnalytics';
import { formatCurrency, formatPercentage } from '@/src/lib/utils';

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

const TIME_RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
] as const;

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
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Portfolio Value Over Time</CardTitle>
                <div className="flex gap-1">
                  {TIME_RANGES.map((range) => (
                    <Button
                      key={range.days}
                      size="sm"
                      variant={rangeDays === range.days ? 'default' : 'outline'}
                      onClick={() => setRangeDays(range.days)}
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {analytics.isLoading ? (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
                      Loading history…
                    </div>
                  ) : analytics.error ? (
                    <div className="text-destructive flex h-full items-center justify-center">
                      Couldn&apos;t load history.
                    </div>
                  ) : (analytics.data?.performance.length ?? 0) === 0 ? (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
                      No historical data available for this range.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.data!.performance}>
                        <defs>
                          <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={primaryAccent} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={primaryAccent} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: axisColor }}
                          stroke={axisColor}
                          tickFormatter={(value: string) => value.slice(5)}
                          minTickGap={24}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: axisColor }}
                          stroke={axisColor}
                          tickFormatter={(value: number) =>
                            value >= 1000
                              ? `$${(value / 1000).toFixed(1)}k`
                              : `$${value.toFixed(0)}`
                          }
                          width={56}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number) => [formatCurrency(value), 'Value']}
                          labelFormatter={(label: string) => label}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={primaryAccent}
                          strokeWidth={2}
                          fill="url(#portfolioFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Gain / Loss by Holding (%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gainLossPerHolding}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                        <XAxis dataKey="symbol" tick={{ fill: axisColor }} stroke={axisColor} />
                        <YAxis
                          tick={{ fill: axisColor }}
                          stroke={axisColor}
                          tickFormatter={(value: number) => `${value}%`}
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number, key: string) =>
                            key === 'gainLossPercent'
                              ? [`${value.toFixed(2)}%`, 'Gain/Loss %']
                              : [formatCurrency(value), 'Gain/Loss']
                          }
                        />
                        <Bar dataKey="gainLossPercent">
                          {gainLossPerHolding.map((entry) => (
                            <Cell
                              key={entry.symbol}
                              fill={entry.gainLossPercent >= 0 ? gainColor : lossColor}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Allocation by Holding</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={holdingAllocation}
                          dataKey="value"
                          nameKey="symbol"
                          innerRadius={50}
                          outerRadius={100}
                          paddingAngle={2}
                        >
                          {holdingAllocation.map((entry, index) => (
                            <Cell
                              key={entry.symbol}
                              fill={allocationColors[index % allocationColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend wrapperStyle={{ color: axisColor }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Allocation by Sector</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {analytics.isLoading ? (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
                      Loading sectors…
                    </div>
                  ) : (analytics.data?.sectors.length ?? 0) === 0 ? (
                    <div className="text-muted-foreground flex h-full items-center justify-center">
                      Sector data unavailable.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.data!.sectors}
                          dataKey="value"
                          nameKey="sector"
                          innerRadius={50}
                          outerRadius={100}
                          paddingAngle={2}
                        >
                          {analytics.data!.sectors.map((entry, index) => (
                            <Cell
                              key={entry.sector}
                              fill={allocationColors[index % allocationColors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        />
                        <Legend wrapperStyle={{ color: axisColor }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
