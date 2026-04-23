import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/src/lib/auth';
import { getClientKey, rateLimit, type RateLimitOptions } from '@/src/lib/rate-limit';

interface GuardOptions {
  /** When true, the request must be authenticated. Defaults to true. */
  requireAuth?: boolean;
  rateLimit?: RateLimitOptions;
}

interface GuardSuccess {
  ok: true;
  userId: string | null;
}

interface GuardFailure {
  ok: false;
  response: NextResponse;
}

export type GuardResult = GuardSuccess | GuardFailure;

export async function guardRequest(
  request: Request,
  options: GuardOptions = {},
): Promise<GuardResult> {
  const { requireAuth = true, rateLimit: rateLimitOptions } = options;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  if (requireAuth && !userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (rateLimitOptions) {
    const key = getClientKey(request, userId);
    const result = rateLimit(key, rateLimitOptions);
    if (!result.success) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Too many requests' },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
            },
          },
        ),
      };
    }
  }

  return { ok: true, userId };
}
