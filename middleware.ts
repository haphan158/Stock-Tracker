import { NextResponse, type NextRequest } from 'next/server';

import { getToken } from 'next-auth/jwt';

/**
 * Global edge middleware.
 *
 * Responsibilities:
 *  1. Stamp every request with `x-request-id`. If the caller sent one (e.g.
 *     an upstream load balancer), we propagate it; otherwise we mint a fresh
 *     UUID. The id is exposed on both the incoming request (so route handlers
 *     can read it via `loggerFromRequest()`) and the outgoing response (so
 *     clients can correlate errors with server logs).
 *  2. Gate authenticated pages. API routes enforce their own auth via
 *     `guardRequest`, so we only redirect unauthenticated HTML page loads.
 *
 * Runs in the edge runtime, so pino/node-only APIs must not be imported here.
 */

const PROTECTED_PATH_PATTERN = /^\/(portfolio|watchlist|analytics)(\/|$)/;

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();

  if (PROTECTED_PATH_PATTERN.test(request.nextUrl.pathname)) {
    const token = await getToken({ req: request });
    if (!token) {
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search);
      const redirect = NextResponse.redirect(signInUrl);
      redirect.headers.set('x-request-id', requestId);
      return redirect;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  /*
   * Run on every path except:
   *  - Next.js internals (_next/*)
   *  - Static asset files served from /public
   *  - The NextAuth API (it manages its own cookies/flows)
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt)).*)',
  ],
};
