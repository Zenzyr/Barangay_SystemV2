import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/bims/:path*",
        destination: `${process.env.BACKEND_INTERNAL_URL || "http://barangay-server:5001"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
