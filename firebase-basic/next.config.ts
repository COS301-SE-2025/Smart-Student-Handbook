import type { NextConfig } from "next"

/**
 * Configuration for SSR/ISR on Firebase Hosting.
 * (No `output: "export"` — pages are rendered by the cloud function.)
 */
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
}

export default nextConfig
