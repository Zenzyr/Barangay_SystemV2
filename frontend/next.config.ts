import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/bims/:path*",
        destination: `${process.env.BACKEND_INTERNAL_URL || "http://backend:5000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
