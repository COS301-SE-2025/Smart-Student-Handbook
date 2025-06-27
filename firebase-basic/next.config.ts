import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

};
module.exports = {
  // ...other config,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  //output: 'export',
  images: {
    unoptimized: true,
  },
};


export default nextConfig;
