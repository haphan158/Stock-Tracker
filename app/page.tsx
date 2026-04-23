'use client';

import { Navigation } from '@/src/components/navigation';
import { StockCard } from '@/src/components/stock-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Search, TrendingUp, TrendingDown, DollarSign, BarChart3, RefreshCw } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useMemo } from 'react';
import { formatCurrency, formatPercentage } from '@/src/lib/utils';
import { useStocks, useStockSearch, useMarketSummary, useRefreshStocks } from '@/src/hooks/useStocks';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import {
  useWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
} from '@/src/hooks/useWatchlist';
import { StockData } from '@/src/lib/stock-service';

// Default stocks to display
const defaultStocks = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA'];

export default function Dashboard() {
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm.trim(), 350);
  const [displayedStocks, setDisplayedStocks] = useState<string[]>(defaultStocks);

  const { data: searchResults = [], isLoading: searchLoading } = useStockSearch(debouncedSearch);

  useEffect(() => {
    if (!debouncedSearch) {
      setDisplayedStocks(defaultStocks);
      return;
    }
    if (!searchLoading) {
      setDisplayedStocks(
        searchResults.length > 0 ? searchResults.map((stock) => stock.symbol) : [],
      );
    }
  }, [debouncedSearch, searchResults, searchLoading]);

  const stableSymbols = useMemo(() => [...displayedStocks].sort(), [displayedStocks]);
  const { data: stocks = [], isLoading: stocksLoading, error: stocksError } = useStocks(stableSymbols);
  const { data: marketSummary, isLoading: marketSummaryLoading } = useMarketSummary();
  const refreshStocks = useRefreshStocks();

  const isAuthenticated = !!session?.user;
  const { data: watchlist = [] } = useWatchlist(isAuthenticated);
  const addWatchlist = useAddToWatchlist();
  const removeWatchlist = useRemoveFromWatchlist();
  const watchedSymbols = useMemo(
    () => new Set(watchlist.map((item) => item.symbol)),
    [watchlist],
  );

  // Calculate market overview
  const totalMarketCap = stocks.reduce((sum, stock) => sum + (stock.marketCap || 0), 0);
  const gainers = stocks.filter(stock => stock.change > 0).length;
  const losers = stocks.filter(stock => stock.change < 0).length;

  // Handle refresh
  const handleRefresh = () => {
    refreshStocks.mutate(stableSymbols);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back{session?.user?.name ? `, ${session.user.name}` : ''}!
          </h1>
          <p className="text-gray-600 mb-4">
            Track your favorite stocks with real-time market data powered by Yahoo Finance.
          </p>
          <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
            🔍 <strong>New!</strong> Search for ANY stock symbol - try "AAPL", "TSLA", "SPY", or any company name!
          </p>
        </div>

        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Market Cap</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stocksLoading ? 'Loading...' : `$${(totalMarketCap / 1e12).toFixed(2)}T`}
              </div>
              <p className="text-xs text-muted-foreground">
                Across tracked stocks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gainers</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stocksLoading ? '...' : gainers}
              </div>
              <p className="text-xs text-muted-foreground">
                Stocks in positive territory
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Losers</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stocksLoading ? '...' : losers}
              </div>
              <p className="text-xs text-muted-foreground">
                Stocks in negative territory
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stocks</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stocksLoading ? '...' : stocks.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Stocks being tracked
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Refresh */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search stocks by symbol (e.g., AAPL, TSLA)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshStocks.isPending || stocksLoading}
            className="flex items-center space-x-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshStocks.isPending ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {stocksError && stocks.length === 0 ? (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">
              Couldn&apos;t load stock data right now. Try refreshing in a minute.
            </p>
          </div>
        ) : stocks.length === 0 && !stocksLoading && stableSymbols.length > 0 ? (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">
              Yahoo Finance is throttling requests from this network. Data will reappear
              automatically once the rate-limit clears (usually 10–30 minutes).
            </p>
          </div>
        ) : null}

        {/* Stock Grid */}
        {stocksLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : stocks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stocks.map((stock) => (
              <StockCard
                key={stock.symbol}
                {...stock}
                isInWatchlist={watchedSymbols.has(stock.symbol)}
                onAddToWatchlist={
                  isAuthenticated ? (symbol) => addWatchlist.mutate(symbol) : undefined
                }
                onRemoveFromWatchlist={
                  isAuthenticated ? (symbol) => removeWatchlist.mutate(symbol) : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm ? 'No stocks found matching your search.' : 'No stocks available.'}
            </p>
          </div>
        )}

        {/* Market Summary Section */}
        {marketSummary && !marketSummaryLoading && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Market Summary</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top Gainers */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">Top Gainers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {marketSummary.gainers.map((stock: StockData) => (
                      <div key={stock.symbol} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{stock.symbol}</div>
                          <div className="text-sm text-gray-600">{stock.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(stock.currentPrice)}</div>
                          <div className="text-sm text-green-600">
                            {formatPercentage(stock.changePercent)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Losers */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Top Losers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {marketSummary.losers.map((stock: StockData) => (
                      <div key={stock.symbol} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{stock.symbol}</div>
                          <div className="text-sm text-gray-600">{stock.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(stock.currentPrice)}</div>
                          <div className="text-sm text-red-600">
                            {formatPercentage(stock.changePercent)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Most Active */}
              <Card>
                <CardHeader>
                  <CardTitle>Most Active</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {marketSummary.mostActive.map((stock: StockData) => (
                      <div key={stock.symbol} className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{stock.symbol}</div>
                          <div className="text-sm text-gray-600">{stock.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(stock.currentPrice)}</div>
                          <div className="text-sm text-gray-600">
                            Vol: {stock.volume?.toLocaleString() || 'N/A'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
