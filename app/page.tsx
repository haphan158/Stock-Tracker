import { DashboardClient } from '@/src/components/dashboard-client';
import { SORTED_DEFAULT_DASHBOARD_SYMBOLS } from '@/src/lib/dashboard-defaults';
import { getMarketSummary } from '@/src/lib/market-summary';
import { getCachedQuotes } from '@/src/lib/quote-cache';

export default async function Home() {
  const [initialStocks, initialMarketSummary] = await Promise.all([
    getCachedQuotes(SORTED_DEFAULT_DASHBOARD_SYMBOLS),
    getMarketSummary(),
  ]);

  return (
    <DashboardClient initialStocks={initialStocks} initialMarketSummary={initialMarketSummary} />
  );
}
