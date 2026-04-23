import { NextResponse } from 'next/server';

import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';
import { getProviderStatus } from '@/src/lib/providers';

import pkg from '../../../package.json';

export const dynamic = 'force-dynamic';

const version = pkg.version;
const gitSha = process.env.GIT_SHA ?? null;

export async function GET(request: Request) {
  const log = loggerFromRequest(request);
  const startedAt = Date.now();
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (error) {
    log.error({ err: error }, '[health] database check failed');
  }

  const providers = getProviderStatus();
  const status = dbOk ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      version,
      gitSha,
      db: dbOk ? 'ok' : 'down',
      providers,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: dbOk ? 200 : 503 },
  );
}
