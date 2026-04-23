import type { Holding } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { type EnrichedHolding, enrichHolding, summarizePortfolio } from '@/src/lib/portfolio';
import type { StockData } from '@/src/lib/stock-service';

// Prisma's Decimal deserializes to string in JSON, but the runtime objects
// are Decimal instances. enrichHolding calls Number(...) on them so plain
// numbers work here — we accept numeric overrides and cast once.
type HoldingOverrides = Partial<Omit<Holding, 'shares' | 'averageCost'>> & {
  shares?: number;
  averageCost?: number;
};

function holding(overrides: HoldingOverrides = {}): Holding {
  const base = {
    id: 'h-1',
    userId: 'u-1',
    symbol: 'AAPL',
    shares: 10,
    averageCost: 100,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
  return base as unknown as Holding;
}

function quote(overrides: Partial<StockData> = {}): StockData {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currentPrice: 150,
    change: 2,
    changePercent: 1.35,
    lastUpdated: new Date('2026-01-03T00:00:00Z'),
    ...overrides,
  };
}

describe('enrichHolding', () => {
  it('computes market value, cost basis, gain/loss with a live quote', () => {
    const result = enrichHolding(
      holding({ shares: 10, averageCost: 100 }),
      quote({ currentPrice: 150 }),
    );

    expect(result.marketValue).toBe(1500);
    expect(result.costBasis).toBe(1000);
    expect(result.gainLoss).toBe(500);
    expect(result.gainLossPercent).toBeCloseTo(50, 10);
    expect(result.quoteAvailable).toBe(true);
    expect(result.currentPrice).toBe(150);
  });

  it('reports a loss with negative gainLoss and negative percent', () => {
    const result = enrichHolding(
      holding({ shares: 4, averageCost: 200 }),
      quote({ currentPrice: 150 }),
    );

    expect(result.costBasis).toBe(800);
    expect(result.marketValue).toBe(600);
    expect(result.gainLoss).toBe(-200);
    expect(result.gainLossPercent).toBeCloseTo(-25, 10);
  });

  it('handles fractional shares', () => {
    const result = enrichHolding(
      holding({ shares: 2.5, averageCost: 100 }),
      quote({ currentPrice: 120 }),
    );

    expect(result.shares).toBe(2.5);
    expect(result.costBasis).toBe(250);
    expect(result.marketValue).toBe(300);
    expect(result.gainLoss).toBe(50);
  });

  it('uses the quote name when available', () => {
    const result = enrichHolding(holding({ symbol: 'AAPL' }), quote({ name: 'Apple Inc.' }));
    expect(result.name).toBe('Apple Inc.');
  });

  it('passes through change and changePercent from the quote', () => {
    const result = enrichHolding(holding(), quote({ change: 3.5, changePercent: 2.4 }));
    expect(result.change).toBe(3.5);
    expect(result.changePercent).toBe(2.4);
  });

  it('preserves createdAt and updatedAt from the holding', () => {
    const h = holding();
    const result = enrichHolding(h, quote());
    expect(result.createdAt).toBe(h.createdAt);
    expect(result.updatedAt).toBe(h.updatedAt);
  });

  describe('when a quote is unavailable', () => {
    it('falls back to averageCost as currentPrice, zeros gainLoss', () => {
      const result = enrichHolding(holding({ shares: 10, averageCost: 100 }), undefined);

      expect(result.quoteAvailable).toBe(false);
      expect(result.currentPrice).toBe(100);
      expect(result.marketValue).toBe(1000);
      expect(result.costBasis).toBe(1000);
      expect(result.gainLoss).toBe(0);
      expect(result.gainLossPercent).toBe(0);
    });

    it('uses the holding symbol as the name', () => {
      const result = enrichHolding(holding({ symbol: 'AAPL' }), undefined);
      expect(result.name).toBe('AAPL');
    });

    it('zeros the change fields', () => {
      const result = enrichHolding(holding(), undefined);
      expect(result.change).toBe(0);
      expect(result.changePercent).toBe(0);
    });

    it('treats a quote with currentPrice = 0 as unavailable', () => {
      const result = enrichHolding(holding(), quote({ currentPrice: 0 }));
      expect(result.quoteAvailable).toBe(false);
      expect(result.gainLoss).toBe(0);
    });

    it('treats a quote with negative currentPrice as unavailable', () => {
      const result = enrichHolding(holding(), quote({ currentPrice: -5 }));
      expect(result.quoteAvailable).toBe(false);
    });

    it('treats a quote with non-finite currentPrice as unavailable', () => {
      const result = enrichHolding(holding(), quote({ currentPrice: Number.NaN }));
      expect(result.quoteAvailable).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles zero shares without throwing (marketValue = 0, gainLoss = 0)', () => {
      const result = enrichHolding(holding({ shares: 0 }), quote({ currentPrice: 150 }));
      expect(result.shares).toBe(0);
      expect(result.marketValue).toBe(0);
      expect(result.costBasis).toBe(0);
      expect(result.gainLoss).toBe(0);
      // costBasis is 0 → percent falls back to 0 (guarded divide).
      expect(result.gainLossPercent).toBe(0);
    });

    it('treats zero-cost shares (free/gifted) as 0% gain even with a live quote', () => {
      const result = enrichHolding(
        holding({ shares: 10, averageCost: 0 }),
        quote({ currentPrice: 150 }),
      );
      expect(result.costBasis).toBe(0);
      expect(result.marketValue).toBe(1500);
      expect(result.gainLoss).toBe(1500);
      expect(result.gainLossPercent).toBe(0);
    });
  });
});

describe('summarizePortfolio', () => {
  function enriched(overrides: Partial<EnrichedHolding> = {}): EnrichedHolding {
    return {
      id: 'h',
      symbol: 'AAPL',
      shares: 10,
      averageCost: 100,
      currentPrice: 150,
      quoteAvailable: true,
      marketValue: 1500,
      costBasis: 1000,
      gainLoss: 500,
      gainLossPercent: 50,
      name: 'Apple Inc.',
      change: 1,
      changePercent: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it('returns zeros for an empty portfolio', () => {
    expect(summarizePortfolio([])).toEqual({
      totalValue: 0,
      totalCost: 0,
      totalGainLoss: 0,
      totalGainLossPercent: 0,
      holdingsCount: 0,
      staleCount: 0,
    });
  });

  it('sums market value and cost basis across live holdings', () => {
    const s = summarizePortfolio([
      enriched({ marketValue: 1500, costBasis: 1000 }),
      enriched({ id: 'h2', symbol: 'MSFT', marketValue: 2000, costBasis: 1600 }),
    ]);

    expect(s.totalValue).toBe(3500);
    expect(s.totalCost).toBe(2600);
    expect(s.totalGainLoss).toBe(900);
    expect(s.totalGainLossPercent).toBeCloseTo((900 / 2600) * 100, 10);
    expect(s.holdingsCount).toBe(2);
    expect(s.staleCount).toBe(0);
  });

  it('excludes stale holdings from totals but still counts them', () => {
    const s = summarizePortfolio([
      enriched({ marketValue: 1500, costBasis: 1000 }),
      enriched({
        id: 'h2',
        symbol: 'STALE',
        quoteAvailable: false,
        marketValue: 9999,
        costBasis: 9999,
      }),
    ]);

    expect(s.totalValue).toBe(1500);
    expect(s.totalCost).toBe(1000);
    expect(s.totalGainLoss).toBe(500);
    expect(s.holdingsCount).toBe(2);
    expect(s.staleCount).toBe(1);
  });

  it('returns 0% when every holding is stale (divide-by-zero guard)', () => {
    const s = summarizePortfolio([
      enriched({ quoteAvailable: false, marketValue: 1, costBasis: 1 }),
      enriched({ id: 'h2', quoteAvailable: false, marketValue: 1, costBasis: 1 }),
    ]);

    expect(s.totalValue).toBe(0);
    expect(s.totalCost).toBe(0);
    expect(s.totalGainLossPercent).toBe(0);
    expect(s.staleCount).toBe(2);
  });

  it('handles aggregate losses (negative totalGainLossPercent)', () => {
    const s = summarizePortfolio([
      enriched({ marketValue: 800, costBasis: 1000 }),
      enriched({ id: 'h2', marketValue: 500, costBasis: 1000 }),
    ]);

    expect(s.totalGainLoss).toBe(-700);
    expect(s.totalGainLossPercent).toBeCloseTo(-35, 10);
  });

  it('returns 0% when total cost is 0 but there is market value (gifted shares)', () => {
    const s = summarizePortfolio([enriched({ costBasis: 0, marketValue: 500 })]);
    expect(s.totalCost).toBe(0);
    expect(s.totalValue).toBe(500);
    expect(s.totalGainLoss).toBe(500);
    expect(s.totalGainLossPercent).toBe(0);
  });
});
