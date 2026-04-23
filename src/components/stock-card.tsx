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
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900">
              {symbol}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">{name}</p>
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
              <Star className="h-5 w-5 text-yellow-500 fill-current" />
            ) : (
              <Star className="h-5 w-5 text-gray-400" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-gray-900">
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
            <span className="text-xs text-gray-500">
              {change > 0 ? 'Gain' : change < 0 ? 'Loss' : 'No Change'}
            </span>
          </div>
          
          {(marketCap || volume) && (
            <div className="pt-2 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
                {marketCap ? (
                  <div>
                    <span className="block font-medium">Market Cap</span>
                    <span>{formatNumber(marketCap)}</span>
                  </div>
                ) : null}
                {volume ? (
                  <div>
                    <span className="block font-medium">Volume</span>
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
