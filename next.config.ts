import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    YOUTUBE_DL_SKIP_PYTHON_CHECK: "1",
  },
  serverExternalPackages: ['yt-dlp-wrap'],
};

export default nextConfig;
