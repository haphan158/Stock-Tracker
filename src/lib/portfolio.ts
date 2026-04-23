import type { Holding } from '@prisma/client';
import type { StockData } from '@/src/lib/stock-service';

export interface EnrichedHolding {
  id: string;
  symbol: string;
  shares: number;
  averageCost: number;
  currentPrice: number;
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
  const currentPrice = quote?.currentPrice ?? averageCost;
  const marketValue = shares * currentPrice;
  const costBasis = shares * averageCost;
  const gainLoss = marketValue - costBasis;
  const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

  return {
    id: holding.id,
    symbol: holding.symbol,
    shares,
    averageCost,
    currentPrice,
    marketValue,
    costBasis,
    gainLoss,
    gainLossPercent,
    name: quote?.name ?? holding.symbol,
    change: quote?.change ?? 0,
    changePercent: quote?.changePercent ?? 0,
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
}

export function summarizePortfolio(holdings: EnrichedHolding[]): PortfolioSummary {
  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalGainLoss = totalValue - totalCost;
  const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPercent,
    holdingsCount: holdings.length,
  };
}
