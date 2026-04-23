'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { formatCurrency, formatNumber, formatPercentage, getChangeColor } from '@/src/lib/utils';

interface StockCardProps {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  marketCap?: number | undefined;
  volume?: number | undefined;
  isInWatchlist?: boolean | undefined;
  onAddToWatchlist?: ((symbol: string) => void) | undefined;
  onRemoveFromWatchlist?: ((symbol: string) => void) | undefined;
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
  const router = useRouter();

  const handleWatchlistToggle = async (event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
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

  const href = `/stocks/${encodeURIComponent(symbol)}`;

  const goToDetail = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      router.push(href);
    }
  };

  const getChangeIcon = () => {
    if (change > 0)
      return <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
    return <Minus className="text-muted-foreground h-4 w-4" />;
  };

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={goToDetail}
      aria-label={`${symbol} — ${name}. Open detail page.`}
      className="hover:border-primary/40 focus-visible:ring-ring cursor-pointer transition-all duration-200 hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-foreground text-lg font-semibold">
              <Link href={href} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                {symbol}
              </Link>
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">{name}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              void handleWatchlistToggle(event);
            }}
            disabled={isLoading}
            className="h-auto p-2"
            aria-label={
              isInWatchlist ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`
            }
            aria-pressed={isInWatchlist}
          >
            {isInWatchlist ? (
              <Star className="h-5 w-5 fill-current text-amber-500" />
            ) : (
              <Star className="text-muted-foreground h-5 w-5" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-foreground text-2xl font-bold">
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
            <span className="text-muted-foreground text-xs">
              {change > 0 ? 'Gain' : change < 0 ? 'Loss' : 'No Change'}
            </span>
          </div>

          {(marketCap || volume) && (
            <div className="border-border border-t pt-2">
              <div className="text-muted-foreground grid grid-cols-2 gap-4 text-xs">
                {marketCap ? (
                  <div>
                    <span className="text-foreground block font-medium">Market Cap</span>
                    <span>{formatNumber(marketCap)}</span>
                  </div>
                ) : null}
                {volume ? (
                  <div>
                    <span className="text-foreground block font-medium">Volume</span>
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
