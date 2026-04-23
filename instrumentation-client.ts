/**
 * Client-side Sentry initialization. Next.js imports this file automatically
 * on the browser once per session. Guarded by NEXT_PUBLIC_SENTRY_DSN so the
 * SDK is only loaded when explicitly enabled.
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void (async () => {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_GIT_SHA,
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
  })();
}

export {};
