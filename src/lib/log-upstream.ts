/**
 * When Yahoo (or similar) rate-limits, the response body is often plain text
 * `Too Many Requests` while the HTTP status can still be treated as "ok" in some
 * client paths, so `undici` runs `JSON.parse` on the body and throws
 * `SyntaxError: Unexpected token 'T' ... not valid JSON`. That is expected
 * behavior, not an application bug — but logging the full Error balloons dev
 * consoles. We detect that case and log a small structured object instead.
 */
export function isLikelyUpstreamRateLimitBody(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message;
  if (m.includes('Too Many Requests') && m.includes('not valid JSON')) return true;
  if (m.includes('Too Many Requests') && m.includes('Unexpected token')) return true;
  if (/^Too Many Requests/i.test(m.trim())) return true;
  return false;
}

/**
 * Returns fields to spread into `logger.*` so rate-limit noise stays compact;
 * otherwise pass through `err` for real failures with stacks.
 */
export function upstreamErrorLogFields(err: unknown): {
  err?: unknown;
  rateLimited?: true;
  upstreamNote?: string;
} {
  if (isLikelyUpstreamRateLimitBody(err)) {
    return {
      rateLimited: true,
      upstreamNote:
        'HTTP 429 or plain-text error body was parsed as JSON (expected for Yahoo throttling).',
    };
  }
  return { err };
}
