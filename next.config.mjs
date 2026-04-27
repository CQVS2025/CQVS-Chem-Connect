/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  reactStrictMode: true,

  turbopack: {
    root: process.cwd(),
  },

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@tanstack/react-query",
    ],
  },

  async rewrites() {
    return [
      { source: "/seo-plan", destination: "/seo-plan.html" },
    ]
  },

  async headers() {
    // Robots block applied to every private path. Lives in HTTP headers
    // because the relevant layouts/pages are "use client" and can't export
    // a `metadata` object — headers fire regardless of render mode and
    // before any JS runs, so they're the most reliable signal.
    const noindex = {
      key: "X-Robots-Tag",
      value: "noindex, nofollow, noarchive, nosnippet",
    }

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
        ],
      },
      // Private routes — keep search engines out completely.
      { source: "/admin/:path*", headers: [noindex] },
      { source: "/dashboard/:path*", headers: [noindex] },
      { source: "/cart", headers: [noindex] },
      { source: "/checkout", headers: [noindex] },
      { source: "/login", headers: [noindex] },
      { source: "/register", headers: [noindex] },
      { source: "/forgot-password", headers: [noindex] },
      { source: "/reset-password", headers: [noindex] },
      { source: "/api/:path*", headers: [noindex] },
    ]
  },
}

export default nextConfig
