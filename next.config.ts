import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheComponents: true,
  turbopack: {},
  experimental: {
    serverActions: {
      maxDuration: 600,
    },
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
} as NextConfig;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

export default withPWA(nextConfig);
