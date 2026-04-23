import { NextResponse } from 'next/server';

import { prisma } from '@/src/lib/prisma';
import { getEnabledProviderNames } from '@/src/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (error) {
    console.error('[health] database check failed', error);
  }

  const providers = getEnabledProviderNames();
  const status = dbOk ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      db: dbOk ? 'ok' : 'down',
      providers,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}
