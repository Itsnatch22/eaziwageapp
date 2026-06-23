import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';

const nextConfig: NextConfig = {
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
