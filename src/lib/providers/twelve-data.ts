import type { HistoricalPoint, QuoteProvider } from '@/src/lib/providers/types';

/**
 * Twelve Data `/time_series` is our historical-prices fallback when Yahoo is
 * rate-limiting. Finnhub's free `/stock/candle` was retired, so Twelve Data
 * (800 req/day, 8/min on free) fills that gap. We deliberately do NOT use it
 * for live quotes — Yahoo + Finnhub cover that chain and Twelve Data has no
 * batch quote endpoint on the free plan.
 */
const BASE_URL = 'https://api.twelvedata.com';

function apiKey(): string | null {
  const key = process.env.TWELVE_DATA_API_KEY;
  return key && key.trim().length > 0 ? key : null;
}

interface TimeSeriesRow {
  datetime: string;
  close?: string;
}

interface TimeSeriesResponse {
  status?: string;
  code?: number;
  message?: string;
  values?: TimeSeriesRow[];
}

export const twelveDataProvider: QuoteProvider = {
  name: 'twelve-data',
  isEnabled() {
    return apiKey() !== null;
  },
  async getHistory(symbol, days) {
    const key = apiKey();
    if (!key) throw new Error('Twelve Data is not configured');

    // `outputsize` is the number of rows to return (newest-first). Add a small
    // buffer so we still hit `days` of data after trimming non-trading days.
    const outputsize = Math.max(1, Math.min(days + 10, 5000));
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval: '1day',
      outputsize: String(outputsize),
      order: 'ASC',
      apikey: key,
    });
    const res = await fetch(`${BASE_URL}/time_series?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Twelve Data /time_series ${res.status}`);
    }
    const data = (await res.json()) as TimeSeriesResponse;

    // Twelve Data returns { status: "error", code: 4xx, message } instead of
    // HTTP errors for most upstream issues (invalid symbol, quota exceeded).
    if (data.status === 'error' || typeof data.code === 'number') {
      throw new Error(`Twelve Data error ${data.code ?? ''}: ${data.message ?? 'unknown'}`.trim());
    }

    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const points: HistoricalPoint[] = [];
    for (const row of data.values ?? []) {
      const close = Number(row.close);
      const date = new Date(row.datetime);
      if (!Number.isFinite(close) || Number.isNaN(date.getTime())) continue;
      if (date.getTime() < cutoffMs) continue;
      points.push({ date, close });
    }
    return points;
  },
};
