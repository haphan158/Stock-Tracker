import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';
import { alertPatchSchema } from '@/src/lib/validators';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 30, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = alertPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.alert.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.direction !== undefined) data.direction = parsed.data.direction;
  if (parsed.data.threshold !== undefined) data.threshold = parsed.data.threshold;
  if (parsed.data.note !== undefined) data.note = parsed.data.note;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;

  try {
    const alert = await prisma.alert.update({ where: { id }, data });
    return NextResponse.json({
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
    });
  } catch (error) {
    loggerFromRequest(request).error({ err: error, userId, alertId: id }, 'Failed to update alert');
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 30, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;
  const { id } = await context.params;

  const existing = await prisma.alert.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await prisma.alert.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    loggerFromRequest(request).error({ err: error, userId, alertId: id }, 'Failed to delete alert');
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}
