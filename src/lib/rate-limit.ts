type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Number of requests allowed per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Small in-memory fixed-window rate limiter. Suitable for a single-instance
 * dev/small-prod deployment; swap for Upstash / Redis when horizontally scaled.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const fresh: Bucket = { count: 1, resetAt: now + options.windowMs };
    buckets.set(key, fresh);
    return { success: true, remaining: options.limit - 1, resetAt: fresh.resetAt };
  }

  if (bucket.count >= options.limit) {
    return { success: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return {
    success: true,
    remaining: options.limit - bucket.count,
    resetAt: bucket.resetAt,
  };
}

/** Best-effort client identifier for rate limiting. */
export function getClientKey(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}
