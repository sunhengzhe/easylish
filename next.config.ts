import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a standalone server for easier container deployment
  output: 'standalone',
};

export default nextConfig;
