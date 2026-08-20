import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/__/auth/:path*',
        destination: 'https://cs-game-fe154.firebaseapp.com/__/auth/:path*',
      },
    ]
  },
};

export default nextConfig;

