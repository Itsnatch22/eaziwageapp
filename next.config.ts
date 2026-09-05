import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';
import { withSentryConfig } from '@sentry/nextjs';

// Static security headers pushed to all responses.
// Content-Security-Policy is NOT here — it is set dynamically in proxy.ts
// with a per-request nonce, which allows 'nonce-{nonce}' in script-src
// instead of the broad 'unsafe-inline'. See proxy.ts for the full CSP.
const securityHeaders = [
  // Accept-CH: lets us detect Windows 11 vs 10 in the login route.
  { key: 'Accept-CH',                value: 'Sec-CH-UA-Platform-Version' },
  // Prevent browsers from MIME-sniffing the content-type.
  { key: 'X-Content-Type-Options',   value: 'nosniff' },
  // Block the page from being embedded in any frame (clickjacking).
  { key: 'X-Frame-Options',          value: 'DENY' },
  // Disable DNS prefetching (minor privacy/security hygiene).
  { key: 'X-DNS-Prefetch-Control',   value: 'off' },
  // Only send the origin (no path/query) in cross-origin Referer headers.
  { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
  // Deny access to microphone and interest-cohort (FLoC).
  // camera and geolocation are intentionally allowed (self) for the onboarding face ID capture and address autofill features.
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=(self), interest-cohort=()',
  },
  // Enforce HTTPS for 2 years, include subdomains, pre-load eligible.
  // Only effective over TLS; browsers ignore it over plain HTTP.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'etfytrhduspebpvybljq.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default withSentryConfig(withBotId(nextConfig), {
  org: 'eaziwage-holdings',
  project: 'javascript-nextjs',
  // Only noisy in CI where build logs are actually reviewed; quiet locally.
  silent: !process.env.CI,
  // No SENTRY_AUTH_TOKEN is configured yet, so source-map upload is skipped
  // (withSentryConfig degrades gracefully — it warns, doesn't fail the
  // build). Stack traces will show minified code until one is added to
  // CI secrets and this build re-run.
  widenClientFileUpload: true,
  // disableLogger/automaticVercelMonitors are the deprecated top-level forms
  // of these, and neither is supported under Turbopack (which this project's
  // dev server and builds use) — omitted rather than set via the new
  // webpack.* nesting, since that nesting only takes effect for webpack builds.
});
