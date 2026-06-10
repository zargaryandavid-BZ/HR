import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid webpack vendor-chunk corruption for Supabase in dev (Next.js 15)
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/ssr"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
