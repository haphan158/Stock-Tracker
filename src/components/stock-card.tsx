'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercentage, getChangeColor } from '@/src/lib/utils';
import { useState } from 'react';

interface StockCardProps {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  marketCap?: number;
  volume?: number;
  isInWatchlist?: boolean;
  onAddToWatchlist?: (symbol: string) => void;
  onRemoveFromWatchlist?: (symbol: string) => void;
}

export function StockCard({
  symbol,
  name,
  currentPrice,
  change,
  changePercent,
  marketCap,
  volume,
  isInWatchlist = false,
  onAddToWatchlist,
  onRemoveFromWatchlist,
}: StockCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleWatchlistToggle = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      if (isInWatchlist && onRemoveFromWatchlist) {
        await onRemoveFromWatchlist(symbol);
      } else if (!isInWatchlist && onAddToWatchlist) {
        await onAddToWatchlist(symbol);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getChangeIcon = () => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className="hover:shadow-lg hover:border-primary/40 transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground">
              {symbol}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{name}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleWatchlistToggle}
            disabled={isLoading}
            className="p-2 h-auto"
            aria-label={isInWatchlist ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
            aria-pressed={isInWatchlist}
          >
            {isInWatchlist ? (
              <Star className="h-5 w-5 text-amber-500 fill-current" />
            ) : (
              <Star className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-foreground">
              {formatCurrency(currentPrice)}
            </span>
            <div className="flex items-center space-x-1">
              {getChangeIcon()}
              <span className={`text-sm font-medium ${getChangeColor(change)}`}>
                {formatCurrency(Math.abs(change))}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${getChangeColor(changePercent)}`}>
              {formatPercentage(changePercent)}
            </span>
            <span className="text-xs text-muted-foreground">
              {change > 0 ? 'Gain' : change < 0 ? 'Loss' : 'No Change'}
            </span>
          </div>

          {(marketCap || volume) && (
            <div className="pt-2 border-t border-border">
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                {marketCap ? (
                  <div>
                    <span className="block font-medium text-foreground">Market Cap</span>
                    <span>{formatNumber(marketCap)}</span>
                  </div>
                ) : null}
                {volume ? (
                  <div>
                    <span className="block font-medium text-foreground">Volume</span>
                    <span>{formatNumber(volume)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
