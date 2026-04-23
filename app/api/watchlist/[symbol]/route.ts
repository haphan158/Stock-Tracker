import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { prisma } from '@/src/lib/prisma';
import { symbolSchema } from '@/src/lib/validators';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> },
) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const { symbol: rawSymbol } = await context.params;
  const parsed = symbolSchema.safeParse(rawSymbol);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
  }

  try {
    await prisma.watchlistItem.delete({
      where: { userId_symbol: { userId, symbol: parsed.data } },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Record not found is a common Prisma "P2025"; treat as already-removed.
    if ((error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ ok: true });
    }
    console.error('Error deleting watchlist item:', error);
    return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 });
  }
}
