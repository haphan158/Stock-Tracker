/**
 * Single place that imports the `yahoo-finance2` default instance so we can
 * tune logging. The stock library maps `debug` / `info` to `console.log` and
 * uses raw `console.error` for a non-fatal "guce" redirect case — that spams
 * dev servers. We quiet the former by default; the latter is filtered in dev
 * only. Set `YAHOO_FINANCE_VERBOSE=1` to restore the library’s full console
 * output.
 */
import yahooFinance from 'yahoo-finance2';

const verboseYahoo =
  process.env.YAHOO_FINANCE_VERBOSE === '1' || process.env.YAHOO_FINANCE_VERBOSE === 'true';

if (!verboseYahoo) {
  yahooFinance.setGlobalConfig({
    logger: {
      // Default implementation logs debug/info to stdout — very noisy in Next dev.
      info: () => {
        return undefined;
      },
      debug: () => {
        return undefined;
      },
      warn: (...args: unknown[]) => {
        console.warn(...args);
      },
      error: (...args: unknown[]) => {
        console.error(...args);
      },
    },
  });
}

const guceFilterKey = '__stockTrackerYahooGuceStderrFilter';
if (
  !verboseYahoo &&
  process.env.NODE_ENV === 'development' &&
  !(globalThis as unknown as Record<string, boolean | undefined>)[guceFilterKey]
) {
  (globalThis as unknown as Record<string, boolean>)[guceFilterKey] = true;
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    const msg = typeof first === 'string' ? first : '';
    if (
      (msg.includes('guce.yahoo.com') && msg.includes('We expected a redirect')) ||
      (msg.includes("We'll try to continue anyway") && msg.includes('safely ignore'))
    ) {
      return;
    }
    orig(...args);
  };
}

yahooFinance.suppressNotices(['yahooSurvey']);

export default yahooFinance;
