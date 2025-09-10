import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a standalone server for easier container deployment
  output: 'standalone',
  images: {
    // Disable built-in image optimization to avoid sharp runtime dependency
    unoptimized: true,
  },
};

export default nextConfig;
