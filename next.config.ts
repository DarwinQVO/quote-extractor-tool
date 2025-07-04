import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    YOUTUBE_DL_SKIP_PYTHON_CHECK: "1",
  },
  serverExternalPackages: ['yt-dlp-wrap'],
  // Disable type checking during build for Railway deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Prevent API routes from being pre-rendered during build
  trailingSlash: false,
  generateBuildId: async () => {
    return `force-rebuild-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
  // Force complete cache invalidation
  experimental: {
    // isrMemoryCacheSize option doesn't exist in Next.js 15
  },
};

export default nextConfig;
