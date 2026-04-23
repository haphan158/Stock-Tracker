import { upstreamErrorLogFields } from '@/src/lib/log-upstream';
import { logger } from '@/src/lib/logger';

/**
 * Reusable exponential-backoff cooldown used by the various caches
 * (quote-cache, sector-cache, history-cache) so that one upstream 429 doesn't
 * cascade into dozens of retries. Each cache owns its own instance so their
 * cooldown windows stay independent — a Yahoo rate-limit on quotes shouldn't
 * freeze sector lookups or vice versa.
 *
 *   - `initialCooldownMs` is the first backoff.
 *   - Subsequent failures double the window (capped at `maxCooldownMs`).
 *   - A success resets both the window and the escalation counter.
 *   - Failures that arrive while a cooldown is already active are *ignored*
 *     for escalation purposes. This prevents a burst of parallel fan-outs
 *     (e.g. 4 symbols all 429ing at once) from instantly bumping the backoff
 *     to the cap.
 */
export interface UpstreamCooldown {
  /** True while the cooldown window is active. */
  isCoolingDown(): boolean;
  /** Call after a successful upstream fetch. Resets the window. */
  recordSuccess(): void;
  /** Call after an upstream failure. Starts (or keeps) the cooldown window. */
  recordFailure(error: unknown, context?: Record<string, unknown>): void;
}

export interface UpstreamCooldownOptions {
  /** Short name used in log messages, e.g. "quote-cache". */
  name: string;
  initialCooldownMs: number;
  maxCooldownMs: number;
}

export function createUpstreamCooldown({
  name,
  initialCooldownMs,
  maxCooldownMs,
}: UpstreamCooldownOptions): UpstreamCooldown {
  let cooldownUntil = 0;
  let currentCooldownMs = initialCooldownMs;

  return {
    isCoolingDown() {
      return Date.now() < cooldownUntil;
    },
    recordSuccess() {
      cooldownUntil = 0;
      currentCooldownMs = initialCooldownMs;
    },
    recordFailure(error, context = {}) {
      const now = Date.now();
      if (now < cooldownUntil) {
        // Already cooling down from an earlier failure in this burst — don't
        // escalate the backoff or spam the logs.
        return;
      }
      cooldownUntil = now + currentCooldownMs;
      const cooledForSec = Math.round(currentCooldownMs / 1000);
      currentCooldownMs = Math.min(currentCooldownMs * 2, maxCooldownMs);
      const fields = upstreamErrorLogFields(error);
      logger.warn(
        { ...context, cooledForSec, ...fields },
        fields.rateLimited
          ? `[${name}] Upstream rate-limited; cooling down ${cooledForSec}s`
          : `[${name}] Upstream fetch failed; cooling down ${cooledForSec}s`,
      );
    },
  };
}
