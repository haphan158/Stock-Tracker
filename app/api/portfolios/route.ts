import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { loggerFromRequest } from '@/src/lib/logger';
import { listPortfolios } from '@/src/lib/portfolios';
import { prisma } from '@/src/lib/prisma';
import { portfolioInputSchema } from '@/src/lib/validators';

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 60, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const portfolios = await listPortfolios(userId);
  return NextResponse.json({
    portfolios: portfolios.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.isDefault,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 20, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = portfolioInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const portfolio = await prisma.portfolio.create({
      data: { userId, name: parsed.data.name, isDefault: false },
    });
    return NextResponse.json({ portfolio }, { status: 201 });
  } catch (error) {
    // Prisma unique-constraint error code: name already taken for this user.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A portfolio with that name already exists' },
        { status: 409 },
      );
    }
    loggerFromRequest(request).error({ err: error, userId }, 'Failed to create portfolio');
    return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
  }
}
