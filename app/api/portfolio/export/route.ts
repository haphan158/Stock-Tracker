import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { formatCsv } from '@/src/lib/csv';
import { resolvePortfolio } from '@/src/lib/portfolios';
import { prisma } from '@/src/lib/prisma';

export async function GET(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 10, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const params = request.nextUrl.searchParams;
  const format = (params.get('format') ?? 'holdings').toLowerCase();

  const portfolio = await resolvePortfolio(userId, params.get('portfolioId'));
  if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });

  const filenameBase = portfolio.name.toLowerCase().replace(/\s+/g, '-');

  if (format === 'transactions') {
    const txs = await prisma.transaction.findMany({
      where: { portfolioId: portfolio.id },
      orderBy: { executedAt: 'asc' },
    });
    const csv = formatCsv(
      txs.map((t) => ({
        symbol: t.symbol,
        type: t.type,
        shares: String(Number(t.shares)),
        price: String(Number(t.price)),
        fee: t.fee === null ? '' : String(Number(t.fee)),
        currency: t.currency,
        executedAt: t.executedAt.toISOString(),
        notes: t.notes ?? '',
      })),
      ['symbol', 'type', 'shares', 'price', 'fee', 'currency', 'executedAt', 'notes'],
    );
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filenameBase}-transactions.csv"`,
      },
    });
  }

  const holdings = await prisma.holding.findMany({
    where: { portfolioId: portfolio.id },
    orderBy: { createdAt: 'asc' },
  });
  const csv = formatCsv(
    holdings.map((h) => ({
      symbol: h.symbol,
      shares: String(Number(h.shares)),
      averageCost: String(Number(h.averageCost)),
      currency: h.currency,
    })),
    ['symbol', 'shares', 'averageCost', 'currency'],
  );
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameBase}-holdings.csv"`,
    },
  });
}
