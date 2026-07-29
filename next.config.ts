import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.cotople.com",
        pathname: "/wp-content/**",
      },
    ],
  },
};

export default nextConfig;
