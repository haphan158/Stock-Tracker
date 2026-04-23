/**
 * Thin wrapper around @sentry/nextjs that no-ops when SENTRY_DSN is unset.
 *
 * The Sentry SDK is imported dynamically so that builds with `SENTRY_DSN`
 * unset never pull `@sentry/node` + OpenTelemetry into the page-data
 * collection graph (which otherwise breaks `output: 'standalone'` builds
 * with a `/_not-found` module resolution error).
 *
 * We intentionally re-export a tiny API surface instead of letting callers
 * import `@sentry/nextjs` directly so that removing Sentry later is a
 * single-file change.
 */

export function isSentryEnabled(): boolean {
  const dsn =
    process.env.SENTRY_DSN ??
    (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined);
  return typeof dsn === 'string' && dsn.length > 0;
}

export interface ReportErrorContext {
  digest?: string | undefined;
  componentStack?: string | undefined;
  tags?: Record<string, string> | undefined;
}

/**
 * Fire-and-forget error report. Safe to call from render or effect hooks —
 * any failure inside the SDK is swallowed so telemetry never escalates into
 * a user-visible error.
 */
export function reportError(error: unknown, context?: ReportErrorContext): void {
  if (!isSentryEnabled()) return;
  void (async () => {
    try {
      const Sentry = await import('@sentry/nextjs');
      Sentry.withScope((scope) => {
        if (context?.tags) {
          for (const [key, value] of Object.entries(context.tags)) {
            scope.setTag(key, value);
          }
        }
        if (context?.digest) {
          scope.setContext('nextjs', {
            digest: context.digest,
            ...(context.componentStack ? { componentStack: context.componentStack } : {}),
          });
        }
        Sentry.captureException(error);
      });
    } catch {
      // Never let telemetry surface as a user-visible error.
    }
  })();
}
