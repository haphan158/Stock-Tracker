import { NextResponse, type NextRequest } from 'next/server';

import { z } from 'zod';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { getCachedQuotes } from '@/src/lib/quote-cache';

const SYMBOL_RE = /^[A-Z0-9.\-]{1,10}$/;

const querySchema = z.object({
  symbols: z
    .string()
    .min(1, 'symbols is required')
    .transform((value) =>
      value
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().regex(SYMBOL_RE, 'Invalid symbol'))
        .min(1, 'At least one symbol is required')
        .max(25, 'At most 25 symbols per request'),
    ),
});

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    requireAuth: false,
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;

  const parsed = querySchema.safeParse({
    symbols: request.nextUrl.searchParams.get('symbols') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const stocks = await getCachedQuotes(parsed.data.symbols);
    return NextResponse.json({ stocks });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, symbols: parsed.data.symbols },
      'Failed to fetch stock quotes',
    );
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 502 });
  }
}
