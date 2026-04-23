import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { StockService } from '@/src/lib/stock-service';
import { guardRequest } from '@/src/lib/api-guard';

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

  try {
    const stocks = await StockService.searchStocks(parsed.data.q);
    return NextResponse.json({ stocks });
  } catch (error) {
    console.error('Error searching stocks:', error);
    return NextResponse.json({ error: 'Failed to search stocks' }, { status: 502 });
  }
}
