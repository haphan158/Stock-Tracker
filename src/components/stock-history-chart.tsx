'use client';

import { useMemo, type CSSProperties } from 'react';

import { useTheme } from 'next-themes';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { useStockHistory } from '@/src/hooks/useStockDetail';
import { formatCurrency } from '@/src/lib/utils';

export const STOCK_HISTORY_RANGES = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '5Y', days: 365 * 5 },
] as const;

export type HistoryRangeDays = (typeof STOCK_HISTORY_RANGES)[number]['days'];

export interface StockHistoryChartProps {
  symbol: string;
  rangeDays: number;
  onRangeChange: (days: number) => void;
}

export function StockHistoryChart({ symbol, rangeDays, onRangeChange }: StockHistoryChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { data, isLoading, error } = useStockHistory(symbol, rangeDays);

  const colors = useMemo(() => {
    return {
      grid: isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
      axis: isDark ? '#94a3b8' : '#64748b',
      line: isDark ? '#60a5fa' : '#2563eb',
    };
  }, [isDark]);

  const tooltipStyle: CSSProperties = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: '0.5rem',
    color: isDark ? '#f1f5f9' : '#0f172a',
  };

  const points = data?.points ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{symbol} price history</CardTitle>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Time range">
          {STOCK_HISTORY_RANGES.map((range) => (
            <Button
              key={range.days}
              size="sm"
              variant={rangeDays === range.days ? 'default' : 'outline'}
              onClick={() => onRangeChange(range.days)}
              aria-selected={rangeDays === range.days}
              role="tab"
            >
              {range.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72" aria-live="polite">
          {isLoading ? (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              Loading history…
            </div>
          ) : error ? (
            <div className="text-destructive flex h-full items-center justify-center">
              Couldn&apos;t load history.
            </div>
          ) : points.length === 0 ? (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              No historical data available for this range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points}>
                <defs>
                  <linearGradient id="stockHistoryFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.line} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={colors.line} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: colors.axis }}
                  stroke={colors.axis}
                  tickFormatter={(value: string) =>
                    // Show just month/day for shorter ranges, year for 5Y.
                    rangeDays > 365 ? value.slice(0, 7) : value.slice(5)
                  }
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: colors.axis }}
                  stroke={colors.axis}
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`
                  }
                  width={56}
                  domain={['dataMin', 'dataMax']}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatCurrency(value), 'Close']}
                  labelFormatter={(label: string) => label}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={colors.line}
                  strokeWidth={2}
                  fill="url(#stockHistoryFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
