import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  /**
   * Local-dev proxy: when running `npm run dev` without Docker (no nginx),
   * relative API calls like `/api/v1/...` would hit the Next.js server (port 3001)
   * and return 404.  These rewrites forward them to the FastAPI backend (port 8000).
   *
   * In production (Docker + nginx): nginx intercepts all `/api/` requests before
   * they reach the Next.js server, so these rewrites are never triggered.
   */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
