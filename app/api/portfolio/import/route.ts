import { NextResponse, type NextRequest } from 'next/server';

import { guardRequest } from '@/src/lib/api-guard';
import { parseCsv } from '@/src/lib/csv';
import { loggerFromRequest } from '@/src/lib/logger';
import { ensureDefaultPortfolio, resolvePortfolio } from '@/src/lib/portfolios';
import { prisma } from '@/src/lib/prisma';
import { recordTransactionAndRecomputeHolding } from '@/src/lib/transactions';
import { getUserPreferences } from '@/src/lib/user-preferences';
import { holdingInputSchema, transactionInputSchema } from '@/src/lib/validators';

interface ImportResult {
  mode: 'holdings' | 'transactions';
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export async function POST(request: NextRequest) {
  const guard = await guardRequest(request, {
    rateLimit: { limit: 5, windowMs: 60_000 },
  });
  if (!guard.ok) return guard.response;
  const userId = guard.userId!;

  const body = await request.text();
  if (!body.trim()) {
    return NextResponse.json({ error: 'Empty CSV body' }, { status: 400 });
  }

  const params = request.nextUrl.searchParams;
  const requestedMode = (params.get('mode') ?? '').toLowerCase();
  const replace = params.get('replace') === '1';

  const portfolio = params.get('portfolioId')
    ? await resolvePortfolio(userId, params.get('portfolioId'))
    : await ensureDefaultPortfolio(userId);
  if (!portfolio) return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });

  const prefs = await getUserPreferences(userId);

  let rows: ReturnType<typeof parseCsv>;
  try {
    rows = parseCsv(body);
  } catch (error) {
    loggerFromRequest(request).warn({ err: error }, '[import] CSV parse failed');
    return NextResponse.json({ error: 'Malformed CSV' }, { status: 400 });
  }
  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV contains no data rows' }, { status: 400 });
  }

  const firstRow = rows[0] ?? {};
  const looksLikeTransactions = 'type' in firstRow && 'price' in firstRow;
  const mode: 'holdings' | 'transactions' = ((): 'holdings' | 'transactions' => {
    if (requestedMode === 'holdings') return 'holdings';
    if (requestedMode === 'transactions') return 'transactions';
    return looksLikeTransactions ? 'transactions' : 'holdings';
  })();

  const result: ImportResult = { mode, imported: 0, skipped: 0, errors: [] };

  try {
    if (replace) {
      // Replace wipes the portfolio before re-seeding. Transactions CSV mode
      // also clears transactions since they are the ledger for holdings.
      await prisma.$transaction([
        prisma.transaction.deleteMany({ where: { portfolioId: portfolio.id } }),
        prisma.holding.deleteMany({ where: { portfolioId: portfolio.id } }),
      ]);
    }

    if (mode === 'holdings') {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const parsed = holdingInputSchema.safeParse({
          symbol: row.symbol,
          shares: row.shares,
          averageCost: row.averageCost ?? row.averagecost,
          currency: row.currency,
        });
        if (!parsed.success) {
          result.skipped++;
          result.errors.push({ row: i + 2, message: parsed.error.issues[0]?.message ?? 'invalid' });
          continue;
        }
        try {
          await prisma.holding.upsert({
            where: {
              portfolioId_symbol: { portfolioId: portfolio.id, symbol: parsed.data.symbol },
            },
            create: {
              userId,
              portfolioId: portfolio.id,
              symbol: parsed.data.symbol,
              shares: parsed.data.shares,
              averageCost: parsed.data.averageCost,
              currency: parsed.data.currency ?? prefs.displayCurrency,
            },
            update: {
              shares: parsed.data.shares,
              averageCost: parsed.data.averageCost,
              currency: parsed.data.currency ?? prefs.displayCurrency,
            },
          });
          result.imported++;
        } catch (error) {
          result.skipped++;
          result.errors.push({
            row: i + 2,
            message: error instanceof Error ? error.message : 'db error',
          });
        }
      }
    } else {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const parsed = transactionInputSchema.safeParse({
          symbol: row.symbol,
          type: (row.type ?? '').toUpperCase(),
          shares: row.shares,
          price: row.price,
          fee: row.fee || undefined,
          currency: row.currency || undefined,
          executedAt: row.executedAt ?? row.executedat ?? row.date,
          notes: row.notes || undefined,
        });
        if (!parsed.success) {
          result.skipped++;
          result.errors.push({ row: i + 2, message: parsed.error.issues[0]?.message ?? 'invalid' });
          continue;
        }
        try {
          await recordTransactionAndRecomputeHolding({
            userId,
            portfolioId: portfolio.id,
            symbol: parsed.data.symbol,
            type: parsed.data.type,
            shares: parsed.data.shares,
            price: parsed.data.price,
            fee: parsed.data.fee ?? null,
            currency: parsed.data.currency ?? prefs.displayCurrency,
            executedAt: parsed.data.executedAt,
            notes: parsed.data.notes ?? null,
          });
          result.imported++;
        } catch (error) {
          result.skipped++;
          result.errors.push({
            row: i + 2,
            message: error instanceof Error ? error.message : 'db error',
          });
        }
      }
    }

    return NextResponse.json(result, { status: result.imported > 0 ? 200 : 400 });
  } catch (error) {
    loggerFromRequest(request).error({ err: error, userId }, 'Portfolio import failed');
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
