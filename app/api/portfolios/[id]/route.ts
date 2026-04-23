import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { prisma } from '@/src/lib/prisma';
import { portfolioPatchSchema } from '@/src/lib/validators';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 20, windowMs: 60_000 },
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

  const parsed = portfolioPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.portfolio.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const portfolio = await prisma.portfolio.update({
      where: { id },
      data: { ...(parsed.data.name ? { name: parsed.data.name } : {}) },
    });
    return NextResponse.json({ portfolio });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A portfolio with that name already exists' },
        { status: 409 },
      );
    }
    loggerFromRequest(request).error(
      { err: error, userId, portfolioId: id },
      'Failed to update portfolio',
    );
    return NextResponse.json({ error: 'Failed to update portfolio' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 20, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;
  const { id } = await context.params;

  const existing = await prisma.portfolio.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  // Allow deleting Default only when other portfolios exist; otherwise the
  // user would have no portfolio at all and the next write would need to
  // re-seed one anyway. Simpler to just block.
  if (existing.isDefault) {
    const totalCount = await prisma.portfolio.count({ where: { userId } });
    if (totalCount <= 1) {
      return NextResponse.json({ error: 'Cannot delete the only portfolio' }, { status: 400 });
    }
  }

  try {
    await prisma.portfolio.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    loggerFromRequest(request).error(
      { err: error, userId, portfolioId: id },
      'Failed to delete portfolio',
    );
    return NextResponse.json({ error: 'Failed to delete portfolio' }, { status: 500 });
  }
}
