import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';

/**
 * Permanently delete the calling user's account and every owned record.
 * All child models are ON DELETE CASCADE-fk'd to User, so a single delete
 * tears down Holdings, Portfolios, Transactions, Alerts, Watchlist, Sessions,
 * Accounts, and Preferences in one round-trip.
 */
export async function DELETE(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 2, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  try {
    await prisma.user.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    loggerFromRequest(request).error({ err: error, userId }, 'Failed to delete account');
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}
