import { notFound } from 'next/navigation';

import { StockDetailClient } from '@/src/components/stock-detail-client';
import { getCachedQuote } from '@/src/lib/quote-cache';
import { SYMBOL_RE } from '@/src/lib/validators';

export const dynamic = 'force-dynamic';

export default async function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) notFound();

  // Seed the client from an RSC quote fetch so the first paint has real data.
  // `getCachedQuote` is allowed to return null when upstreams are throttled;
  // the client falls back to its own fetch in that case.
  const initialStock = await getCachedQuote(symbol).catch(() => null);

  return <StockDetailClient symbol={symbol} initialStock={initialStock} />;
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).trim().toUpperCase();
  return {
    title: `${symbol} — Stock Tracker`,
    description: `Live price, chart, and news for ${symbol}.`,
  };
}
