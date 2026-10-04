import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Explicit host for the shared development browser; no extra origins by default.
  allowedDevOrigins: process.env.AKASHIC_DEV_ORIGIN ? [process.env.AKASHIC_DEV_ORIGIN] : [],
};

export default nextConfig;
