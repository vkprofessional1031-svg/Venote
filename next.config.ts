import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: '/app/this-week', destination: '/overview', permanent: true }];
  },
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;
