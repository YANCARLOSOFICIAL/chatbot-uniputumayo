import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  /**
   * API proxy rewrite so that relative `/api/*` calls are forwarded to the
   * backend when there is no nginx in front.
   *
   * The destination is controlled by INTERNAL_API_URL (a SERVER-SIDE runtime
   * variable, NOT exposed to the browser):
   *
   *   • npm run dev (local, no Docker)  → not set → defaults to http://localhost:8000
   *   • Docker container accessed directly on :3001 → set to http://backend:8000
   *   • Production via nginx on :80/:8080 → nginx intercepts /api/* before
   *     the request ever reaches Next.js, so this rewrite is NEVER triggered
   */
  async rewrites() {
    const target = process.env.INTERNAL_API_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
