import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { getCompanyNews, isNewsConfigured } from '@/src/lib/news-cache';
import { symbolSchema } from '@/src/lib/validators';

export async function GET(request: NextRequest, context: { params: Promise<{ symbol: string }> }) {
  const guard = await guardRequest(request, {
    requireAuth: false,
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;

  const { symbol: rawSymbol } = await context.params;
  const parsed = symbolSchema.safeParse(rawSymbol);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  if (!isNewsConfigured()) {
    // News lives on the free Finnhub tier — without a key we can't serve
    // anything. Signal it explicitly so the UI can show a setup hint instead
    // of a scary error.
    return NextResponse.json({ articles: [], configured: false });
  }

  try {
    const articles = await getCompanyNews(parsed.data);
    return NextResponse.json({ articles, configured: true });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, symbol: parsed.data },
      'Failed to fetch company news',
    );
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 502 });
  }
}
