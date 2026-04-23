import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';
import { alertInputSchema } from '@/src/lib/validators';

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const alerts = await prisma.alert.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      direction: a.direction,
      threshold: Number(a.threshold),
      active: a.active,
      note: a.note,
      lastTriggeredAt: a.lastTriggeredAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  });
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

  const parsed = alertInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const alert = await prisma.alert.create({
      data: {
        userId,
        symbol: parsed.data.symbol,
        direction: parsed.data.direction,
        threshold: parsed.data.threshold,
        note: parsed.data.note ?? null,
        active: parsed.data.active ?? true,
      },
    });
    return NextResponse.json(
      {
        alert: {
          id: alert.id,
          symbol: alert.symbol,
          direction: alert.direction,
          threshold: Number(alert.threshold),
          active: alert.active,
          note: alert.note,
          lastTriggeredAt: alert.lastTriggeredAt?.toISOString() ?? null,
          createdAt: alert.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    loggerFromRequest(request).error({ err: error, userId }, 'Failed to create alert');
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
