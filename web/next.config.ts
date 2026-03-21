import type { NextConfig } from "next";

const FASTAPI_INTERNAL = process.env.FASTAPI_URL || "http://127.0.0.1:9000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${FASTAPI_INTERNAL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
