import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server build for containerized deploys (Zeabur/zbpack runs node server.js).
  output: "standalone",
};

export default nextConfig;
