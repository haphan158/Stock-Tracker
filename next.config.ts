import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Security headers applied to every response.
 *
 * Verify with https://securityheaders.com after each deploy.
 *
 * CSP notes:
 *  - 'unsafe-inline' on script-src is needed for Next.js inline bootstrap/hydration
 *    scripts. If you remove it you must also add per-request nonces via
 *    middleware and wire them into <Script> tags.
 *  - 'unsafe-eval' is only added in dev so Turbopack HMR works. It is NOT
 *    shipped to production.
 *  - Google OAuth needs accounts.google.com and googleusercontent.com to be
 *    reachable for the sign-in redirect and avatar images.
 */
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  'https://accounts.google.com',
].join(' ');

const connectSrc = [
  "'self'",
  'https://accounts.google.com',
  // Providers are called from server components/route handlers, not the
  // browser — no need to allow them in connect-src.
].join(' ');

const imgSrc = [
  "'self'",
  'data:',
  'blob:',
  'https://lh3.googleusercontent.com', // Google account avatars
].join(' ');

const contentSecurityPolicy = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src ${imgSrc}`,
  `font-src 'self' data:`,
  `connect-src ${connectSrc}`,
  `frame-src https://accounts.google.com`,
  `frame-ancestors 'none'`,
  `form-action 'self' https://accounts.google.com`,
  `base-uri 'self'`,
  `object-src 'none'`,
  ...(isDev ? [] : [`upgrade-insecure-requests`]),
]
  .join('; ')
  .trim();

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
  {
    key: 'Strict-Transport-Security',
    // 2 years, cover subdomains, preload-eligible.
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'lh3.googleusercontent.com' }],
  },
  // Sentry's Node SDK pulls in OpenTelemetry + Prisma instrumentation, both
  // of which use dynamic `require()` calls that Webpack can't bundle cleanly
  // with `output: 'standalone'`. Marking them external lets Node resolve them
  // at runtime from node_modules, which also silences the "Critical
  // dependency" warnings during `next build`.
  serverExternalPackages: [
    '@sentry/node',
    '@sentry/nextjs',
    '@opentelemetry/instrumentation',
    '@prisma/instrumentation',
    // pino uses dynamic requires and (for pretty output) worker threads via
    // thread-stream. Leaving them external means Node resolves them from
    // node_modules at runtime, which both silences bundler warnings and
    // avoids the `/ROOT/node_modules/thread-stream/lib/worker.js` runtime
    // crash we hit when Turbopack rewrote the worker path.
    'pino',
    'pino-pretty',
    'thread-stream',
  ],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
