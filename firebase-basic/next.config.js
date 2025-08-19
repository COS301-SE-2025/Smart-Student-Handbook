/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turn off strict mode (optional)
  reactStrictMode: false,

  // ✅ Skip ESLint during `next build`
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ Allow type errors to not fail `next build`
  typescript: {
    ignoreBuildErrors: true,
  },

  // If you’re using yjs in server code, keep it external
  serverExternalPackages: ['yjs'],

  // Useful for static deploys / Firebase Hosting image handling
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
