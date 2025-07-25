import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  distDir: 'out',
  eslint: {
    ignoreDuringBuilds: true, // Temporarily disable ESLint during builds
  },
};

export default nextConfig;