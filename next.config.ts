import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    YOUTUBE_DL_SKIP_PYTHON_CHECK: "1",
    // Ensure these are available in client-side
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
