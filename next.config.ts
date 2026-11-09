import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Gzip/Brotli compression for responses (smaller pages on mobile networks).
  compress: true,
  // Heavy server-only parsers stay in node_modules (loaded dynamically at runtime).
  serverExternalPackages: ["unpdf", "@e965/xlsx"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Static sample files + build assets can be cached hard.
        source: "/samples/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, immutable" }],
      },
    ];
  },
};

export default nextConfig;
