/**
 * Next.js server & edge instrumentation entrypoint.
 *
 * Invoked once per runtime on cold start. We use a dynamic import for the
 * Sentry SDK so that when `SENTRY_DSN` is not set the heavyweight
 * `@sentry/node` + OpenTelemetry graph never participates in `next build`'s
 * page data collection. This avoids the `PageNotFoundError: /_not-found`
 * regression that hits `output: 'standalone'` builds when Sentry is imported
 * statically here.
 */

import type * as SentryNextjs from '@sentry/nextjs';

export async function register(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import('@sentry/nextjs');

  const commonOptions = {
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.GIT_SHA,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  };

  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init(commonOptions);
  }
}

export async function onRequestError(
  ...args: Parameters<typeof SentryNextjs.captureRequestError>
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.captureRequestError(...args);
}
