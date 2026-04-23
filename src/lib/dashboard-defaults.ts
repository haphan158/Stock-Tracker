/** Default tickers on the home dashboard (grid + overview cards). */
export const DEFAULT_DASHBOARD_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA'] as const;

/**
 * The dashboard uses a sorted list for React Query keys and API requests.
 * Keep this in sync with `displayedStocks` → `stableSymbols` in the client.
 */
export const SORTED_DEFAULT_DASHBOARD_SYMBOLS: string[] = [...DEFAULT_DASHBOARD_SYMBOLS].sort(
  (a, b) => a.localeCompare(b),
);
