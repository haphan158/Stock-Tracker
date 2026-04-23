import { NextResponse, type NextRequest } from 'next/server';

import { z } from 'zod';

import { guardRequest } from '@/src/lib/api-guard';
import { StockService } from '@/src/lib/stock-service';

const querySchema = z.object({
  q: z.string().trim().min(1, 'q is required').max(64, 'q too long'),
});

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    requireAuth: false,
    rateLimit: { limit: 30, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;

  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get('q') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { q } = parsed.data;

  try {
    const stocks = await StockService.searchStocks(q);

    return NextResponse.json({
      stocks,
      query: q,
      resultsCount: stocks.length,
    });
  } catch (error) {
    console.error('Error discovering stocks:', error);
    return NextResponse.json({ error: 'Failed to discover stocks' }, { status: 502 });
  }
}
