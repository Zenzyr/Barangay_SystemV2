import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    const base = "/pages/secretary/document-templates";
    return [
      { source: `${base}/create`, destination: `${base}?create=1`, permanent: true },
      { source: `${base}/edit/:id`, destination: `${base}?edit=:id`, permanent: true },
      { source: `${base}/docx`, destination: `${base}?tab=layouts`, permanent: true },
      { source: `${base}/docx/:id/edit`, destination: `${base}?docx=:id`, permanent: true },
    ];
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
