import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';

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
  // Deny access to camera, mic, geolocation, and interest-cohort (FLoC).
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
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

export default withBotId(nextConfig);
