import type { Portfolio } from '@prisma/client';

import { prisma } from '@/src/lib/prisma';

/**
 * Lazily create the user's "Default" portfolio the first time something needs
 * one. Called from every endpoint that writes Holdings or Transactions so new
 * users (and the first request from users who pre-existed the Portfolio
 * migration) always have somewhere to put their data.
 *
 * Safe under concurrent calls: the migration seeded a unique (userId, name)
 * constraint, so the upsert collapses to the existing row.
 */
export async function ensureDefaultPortfolio(userId: string): Promise<Portfolio> {
  const existing = await prisma.portfolio.findFirst({
    where: { userId, isDefault: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  return prisma.portfolio.upsert({
    where: { userId_name: { userId, name: 'Default' } },
    create: { userId, name: 'Default', isDefault: true },
    update: {},
  });
}

/** All portfolios for a user, oldest first (so Default lands at the top). */
export async function listPortfolios(userId: string): Promise<Portfolio[]> {
  const portfolios = await prisma.portfolio.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  if (portfolios.length > 0) return portfolios;
  const defaultPortfolio = await ensureDefaultPortfolio(userId);
  return [defaultPortfolio];
}

/**
 * Resolve a portfolio id supplied by the client. Falls back to Default when no
 * id is provided and 404s when the caller references a portfolio they don't
 * own (never throws raw Prisma NotFound — callers decide the HTTP response).
 */
export async function resolvePortfolio(
  userId: string,
  portfolioId: string | null | undefined,
): Promise<Portfolio | null> {
  if (portfolioId && portfolioId.trim().length > 0) {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio || portfolio.userId !== userId) return null;
    return portfolio;
  }
  return ensureDefaultPortfolio(userId);
}
