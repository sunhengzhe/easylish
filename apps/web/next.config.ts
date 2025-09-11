import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a standalone server for easier container deployment
  output: 'standalone',
  eslint: {
    // Do not block production builds on lint errors; run lint separately
    ignoreDuringBuilds: true,
  },
  images: {
    // Disable built-in image optimization to avoid sharp runtime dependency
    unoptimized: true,
  },
};

export default nextConfig;
