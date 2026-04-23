import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';

/**
 * Nuke every active session for the calling user. With the next-auth database
 * adapter this force-signs them out of every device at the next request.
 */
export async function DELETE(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 5, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  try {
    const { count } = await prisma.session.deleteMany({ where: { userId } });
    return NextResponse.json({ ok: true, revokedCount: count });
  } catch (error) {
    loggerFromRequest(request).error({ err: error, userId }, 'Failed to revoke sessions');
    return NextResponse.json({ error: 'Failed to sign out of all devices' }, { status: 500 });
  }
}
