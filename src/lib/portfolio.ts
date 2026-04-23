import type { Holding } from '@prisma/client';
import type { StockData } from '@/src/lib/stock-service';

export interface EnrichedHolding {
  id: string;
  symbol: string;
  shares: number;
  averageCost: number;
  /** Latest known price. Falls back to averageCost when quote is unavailable. */
  currentPrice: number;
  /** True when a live quote was returned; false when we're showing cost basis as a placeholder. */
  quoteAvailable: boolean;
  marketValue: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
  name: string;
  change: number;
  changePercent: number;
  createdAt: Date;
  updatedAt: Date;
}

export function enrichHolding(holding: Holding, quote: StockData | undefined): EnrichedHolding {
  const shares = Number(holding.shares);
  const averageCost = Number(holding.averageCost);
  const quoteAvailable = !!quote && Number.isFinite(quote.currentPrice) && quote.currentPrice > 0;
  const currentPrice = quoteAvailable ? quote!.currentPrice : averageCost;
  const marketValue = shares * currentPrice;
  const costBasis = shares * averageCost;
  const gainLoss = quoteAvailable ? marketValue - costBasis : 0;
  const gainLossPercent = quoteAvailable && costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

  return {
    id: holding.id,
    symbol: holding.symbol,
    shares,
    averageCost,
    currentPrice,
    quoteAvailable,
    marketValue,
    costBasis,
    gainLoss,
    gainLossPercent,
    name: quote?.name ?? holding.symbol,
    change: quoteAvailable ? quote!.change : 0,
    changePercent: quoteAvailable ? quote!.changePercent : 0,
    createdAt: holding.createdAt,
    updatedAt: holding.updatedAt,
  };
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  holdingsCount: number;
  /** Count of holdings that did not return a live quote. */
  staleCount: number;
}

export function summarizePortfolio(holdings: EnrichedHolding[]): PortfolioSummary {
  // Totals only reflect holdings with live quotes; stale placeholders would
  // otherwise skew the displayed P/L towards zero without the user noticing.
  const live = holdings.filter((h) => h.quoteAvailable);
  const totalValue = live.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = live.reduce((sum, h) => sum + h.costBasis, 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const staleCount = holdings.length - live.length;

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    holdingsCount: holdings.length,
    staleCount,
  };
}
