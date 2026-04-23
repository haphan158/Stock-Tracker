import { NextResponse, type NextRequest } from 'next/server';

import { z } from 'zod';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';
import { getCachedQuotes } from '@/src/lib/quote-cache';
import { symbolSchema } from '@/src/lib/validators';

const postBodySchema = z.object({ symbol: symbolSchema });

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const items = await prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const symbols = items.map((item) => item.symbol);
  const quotes = await getCachedQuotes(symbols);
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  const watchlist = items.map((item) => ({
    id: item.id,
    symbol: item.symbol,
    createdAt: item.createdAt,
    quote: quoteMap.get(item.symbol) ?? null,
  }));

  return NextResponse.json({ watchlist });
}

export async function POST(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 30, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const item = await prisma.watchlistItem.upsert({
      where: { userId_symbol: { userId, symbol: parsed.data.symbol } },
      create: { userId, symbol: parsed.data.symbol },
      update: {},
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, userId, symbol: parsed.data.symbol },
      'Failed to add watchlist item',
    );
    return NextResponse.json({ error: 'Failed to add to watchlist' }, { status: 500 });
  }
}
