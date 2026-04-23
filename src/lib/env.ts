import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FINNHUB_API_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/**
 * Lazily parses and caches server-side environment variables.
 *
 * Never call this at module top-level in files imported by the client bundle,
 * and avoid calling it during `next build` unless secrets are available in
 * the build environment. Prefer calling it inside route handlers, server
 * components, or server actions.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid server environment variables:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
