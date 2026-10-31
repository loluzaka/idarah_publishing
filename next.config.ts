import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        port: '',
        pathname: '/**',
      },
    ],
    // 30-day cache TTL for optimized images
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Fewer, tighter srcset widths (the default list goes up to 3840w). Sanity
    // images are served by SanityImage's custom loader straight from cdn.sanity.io.
    deviceSizes: [360, 640, 828, 1080, 1280, 1920],
    imageSizes: [96, 144, 240, 320, 400],
  },

  // Security + SEO response headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
