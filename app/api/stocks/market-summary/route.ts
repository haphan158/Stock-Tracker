import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { getMarketSummary } from '@/src/lib/market-summary';

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    requireAuth: false,
    rateLimit: { limit: 20, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;

  const data = await getMarketSummary();
  return NextResponse.json(data);
}
