import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { getCachedQuote } from '@/src/lib/quote-cache';
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

  try {
    const quote = await getCachedQuote(parsed.data);
    if (!quote) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 });
    }
    return NextResponse.json({ stock: quote });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, symbol: parsed.data },
      'Failed to load stock quote',
    );
    return NextResponse.json({ error: 'Failed to load stock data' }, { status: 502 });
  }
}
