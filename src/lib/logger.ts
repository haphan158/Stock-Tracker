import pino, { type Logger, type LoggerOptions } from 'pino';
import type PinoPretty from 'pino-pretty';

/**
 * Shared structured logger.
 *
 * In production we emit one-line JSON (machine-parseable, Vercel/Datadog-friendly).
 * In development we format through pino-pretty as a *synchronous* stream —
 * NOT via `transport: { target: 'pino-pretty' }`. The transport path spawns
 * a worker thread through `thread-stream`, which breaks under Next.js
 * bundling because the worker's script path gets rewritten to a virtual
 * `/ROOT/...` location that doesn't exist on disk. Using pretty as a plain
 * stream keeps everything in-process and bundler-safe.
 *
 * Usage:
 *   import { logger } from '@/src/lib/logger';
 *   logger.info({ userId }, 'fetched portfolio');
 *   logger.error({ err }, 'something broke');
 *
 * For per-request context, use `logger.child({ requestId })` or the
 * `loggerFromRequest()` helper below.
 */

const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

const level = process.env.LOG_LEVEL ?? (isTest ? 'silent' : isDev ? 'debug' : 'info');

const baseOptions: LoggerOptions = {
  level,
  base: { service: 'stock-tracker' },
  // Standard serializer for Error instances keeps stack traces structured.
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
  // Redact common secret-bearing keys if they ever sneak into log contexts.
  redact: {
    paths: [
      'password',
      '*.password',
      'authorization',
      '*.authorization',
      'cookie',
      '*.cookie',
      'set-cookie',
      '*.set-cookie',
    ],
    censor: '[REDACTED]',
    remove: false,
  },
};

function createLogger(): Logger {
  if (isDev && !isTest) {
    // `require` inside the factory so pino-pretty is only loaded when we're
    // actually going to use it (prod bundles never need it).
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pretty = require('pino-pretty') as typeof PinoPretty;
      const stream = pretty({
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
        singleLine: false,
      });
      return pino(baseOptions, stream);
    } catch {
      // Fall through to JSON logging if pino-pretty isn't resolvable for any
      // reason (e.g. prod-only install). Better to log JSON than to crash.
    }
  }
  return pino(baseOptions);
}

export const logger: Logger = createLogger();

/**
 * Build a child logger scoped to a single request. Pass the `x-request-id`
 * header from middleware here so every subsequent log line can be correlated
 * back to the originating request.
 */
export function loggerFromRequest(request: Request): Logger {
  const requestId = request.headers.get('x-request-id') ?? undefined;
  const method = request.method;
  const url = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return undefined;
    }
  })();
  return logger.child({ requestId, method, path: url });
}

export type { Logger };
