'use client';

import type { CSSProperties } from 'react';

import type { UseQueryResult } from '@tanstack/react-query';
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

import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import type { PortfolioAnalytics } from '@/src/hooks/usePortfolioAnalytics';
import { formatCurrency } from '@/src/lib/utils';

const TIME_RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
] as const;

export interface AnalyticsChartsProps {
  rangeDays: number;
  onRangeChange: (days: number) => void;
  allocationColors: string[];
  gridStroke: string;
  axisColor: string;
  primaryAccent: string;
  gainColor: string;
  lossColor: string;
  tooltipStyle: CSSProperties;
  holdingAllocation: { symbol: string; value: number; percent: number }[];
  gainLossPerHolding: { symbol: string; gainLoss: number; gainLossPercent: number }[];
  portfolioAnalytics: UseQueryResult<PortfolioAnalytics, Error>;
}

export function AnalyticsCharts({
  rangeDays,
  onRangeChange,
  allocationColors,
  gridStroke,
  axisColor,
  primaryAccent,
  gainColor,
  lossColor,
  tooltipStyle,
  holdingAllocation,
  gainLossPerHolding,
  portfolioAnalytics: analytics,
}: AnalyticsChartsProps) {
  return (
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
                onClick={() => onRangeChange(range.days)}
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
                      value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`
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
  );
}
