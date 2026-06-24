import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Tells browsers to include Sec-CH-UA-Platform-Version on subsequent requests,
          // which lets us distinguish Windows 11 from Windows 10 in the login route.
          { key: 'Accept-CH', value: 'Sec-CH-UA-Platform-Version' },
        ],
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
