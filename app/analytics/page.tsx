'use client';

import { useMemo, useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { usePortfolio } from '@/src/hooks/usePortfolio';
import { usePortfolioAnalytics } from '@/src/hooks/usePortfolioAnalytics';
import { formatCurrency, formatPercentage } from '@/src/lib/utils';

const ALLOCATION_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#9333ea',
  '#db2777',
  '#14b8a6',
  '#eab308',
  '#64748b',
];

const TIME_RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
] as const;

export default function AnalyticsPage() {
  const [rangeDays, setRangeDays] = useState<number>(90);

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
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
          <p className="text-gray-600">
            A snapshot of your portfolio performance, computed from your holdings.
          </p>
        </div>

        {error ? (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            Failed to load analytics.
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Return</CardTitle>
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
                {formatPercentage(summary?.totalGainLossPercent ?? 0)}
              </div>
              <p className="text-xs text-gray-500">Unrealized P/L across all holdings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Holdings</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.holdingsCount ?? 0}</div>
              <p className="text-xs text-gray-500">Distinct positions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Best Performer</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {bestPerformer ? `${formatPercentage(bestPerformer.gainLossPercent)}` : '—'}
              </div>
              <p className="text-xs text-gray-500">
                {bestPerformer ? bestPerformer.symbol : 'No holdings'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Worst Performer</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {worstPerformer ? formatPercentage(worstPerformer.gainLossPercent) : '—'}
              </div>
              <p className="text-xs text-gray-500">
                {worstPerformer ? worstPerformer.symbol : 'No holdings'}
              </p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">Loading analytics…</CardContent>
          </Card>
        ) : holdings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Add holdings in the Portfolio page to see analytics.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                    <div className="h-full flex items-center justify-center text-gray-500">
                      Loading history…
                    </div>
                  ) : analytics.error ? (
                    <div className="h-full flex items-center justify-center text-red-600">
                      Couldn&apos;t load history.
                    </div>
                  ) : (analytics.data?.performance.length ?? 0) === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      No historical data available for this range.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.data!.performance}>
                        <defs>
                          <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value: string) => value.slice(5)}
                          minTickGap={24}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value: number) =>
                            value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`
                          }
                          width={56}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Value']}
                          labelFormatter={(label: string) => label}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#2563eb"
                          strokeWidth={2}
                          fill="url(#portfolioFill)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Gain / Loss by Holding (%)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gainLossPerHolding}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="symbol" />
                        <YAxis tickFormatter={(value: number) => `${value}%`} />
                        <Tooltip
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
                              fill={entry.gainLossPercent >= 0 ? '#16a34a' : '#dc2626'}
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
                              fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Legend />
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
                    <div className="h-full flex items-center justify-center text-gray-500">
                      Loading sectors…
                    </div>
                  ) : (analytics.data?.sectors.length ?? 0) === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
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
                              fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            formatCurrency(value),
                            name,
                          ]}
                        />
                        <Legend />
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
