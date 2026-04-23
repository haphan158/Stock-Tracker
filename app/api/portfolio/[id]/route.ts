import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';
import { holdingPatchSchema } from '@/src/lib/validators';

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

  const parsed = holdingPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.shares === undefined && parsed.data.averageCost === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    const existing = await prisma.holding.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const updateData: { shares?: number; averageCost?: number } = {};
    if (parsed.data.shares !== undefined) updateData.shares = parsed.data.shares;
    if (parsed.data.averageCost !== undefined) updateData.averageCost = parsed.data.averageCost;
    const holding = await prisma.holding.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ holding });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, userId, holdingId: id },
      'Failed to update holding',
    );
    return NextResponse.json({ error: 'Failed to update holding' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;
  const { id } = await context.params;

  try {
    const existing = await prisma.holding.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await prisma.holding.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, userId, holdingId: id },
      'Failed to delete holding',
    );
    return NextResponse.json({ error: 'Failed to delete holding' }, { status: 500 });
  }
}
