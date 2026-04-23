'use client';

import { useMemo } from 'react';
import {
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
import { BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { usePortfolio } from '@/src/hooks/usePortfolio';
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

export default function AnalyticsPage() {
  const { data, isLoading, error } = usePortfolio();
  const holdings = useMemo(() => data?.holdings ?? [], [data]);
  const summary = data?.summary;

  const allocation = useMemo(() => {
    const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    return holdings
      .map((h) => ({
        symbol: h.symbol,
        name: h.name,
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
  const worstPerformer = gainLossPerHolding[gainLossPerHolding.length - 1];

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
                {worstPerformer && worstPerformer !== bestPerformer
                  ? formatPercentage(worstPerformer.gainLossPercent)
                  : '—'}
              </div>
              <p className="text-xs text-gray-500">
                {worstPerformer && worstPerformer !== bestPerformer
                  ? worstPerformer.symbol
                  : 'No holdings'}
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
                <CardTitle>Allocation by Market Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocation}
                        dataKey="value"
                        nameKey="symbol"
                        innerRadius={50}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {allocation.map((entry, index) => (
                          <Cell
                            key={entry.symbol}
                            fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
