import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["yjs"],
  eslint: {
    // Don't fail the production build on ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Don't fail production builds on type errors
    ignoreBuildErrors: true,
  },
  // output: 'export', // uncomment if you're using static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
