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
    return 'build-' + Date.now();
  },
};

export default nextConfig;
