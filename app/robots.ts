import type { MetadataRoute } from "next"

/**
 * robots.txt - public catalog open to classic crawlers and the major LLM
 * crawlers. Private routes (cart, checkout, account, admin, API) are blocked
 * for everyone. Defence in depth: the X-Robots-Tag header in
 * next.config.mjs blocks the same paths even before robots.txt is fetched.
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

const DISALLOWED_PATHS = [
  "/cart",
  "/checkout",
  "/dashboard",
  "/dashboard/",
  "/admin",
  "/admin/",
  "/api/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  // Faceted-navigation crawl-budget protection. The /products page uses
  // these query strings for filter / sort UI; they all canonicalise back
  // to /products via the metadata canonical, but blocking them in robots
  // is defence in depth - keeps Googlebot focused on canonical URLs and
  // out of the combinatorial explosion of filter combinations.
  "/products?*sort=*",
  "/products?*stock=*",
  "/products?*region=*",
  "/products?*category=*",
  "/*?utm_*",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default behaviour for every crawler.
      { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },

      // LLM crawlers - explicit allow-list for the public catalog so we get
      // cited in ChatGPT / Perplexity / Claude / Google AI Overviews.
      // Same private-path block as classic crawlers.
      { userAgent: "GPTBot", allow: "/", disallow: DISALLOWED_PATHS },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: DISALLOWED_PATHS },
      { userAgent: "ChatGPT-User", allow: "/", disallow: DISALLOWED_PATHS },
      { userAgent: "PerplexityBot", allow: "/", disallow: DISALLOWED_PATHS },
      { userAgent: "ClaudeBot", allow: "/", disallow: DISALLOWED_PATHS },
      { userAgent: "Claude-Web", allow: "/", disallow: DISALLOWED_PATHS },
      { userAgent: "Google-Extended", allow: "/", disallow: DISALLOWED_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
