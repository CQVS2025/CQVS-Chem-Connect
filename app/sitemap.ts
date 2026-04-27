import type { MetadataRoute } from "next"

import { slugify } from "@/lib/seo/helpers"

/**
 * Dynamic sitemap.xml - auto-updates as products are added / removed in
 * Supabase. 10-minute revalidation keeps the file fresh without hammering
 * the database on every crawl.
 *
 * Public catalog only. Private routes (cart, checkout, account, admin) are
 * never listed here - they're also blocked in robots.ts and via the
 * X-Robots-Tag header in next.config.mjs (defence in depth).
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

const STATE_SLUGS = ["nsw", "vic", "qld", "sa", "wa"] as const

interface ProductRow {
  slug: string
  updated_at: string
  image_url: string | null
  manufacturer?: string | null
  region?: string | null
}

async function getActiveProducts(): Promise<ProductRow[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return []

  try {
    const res = await fetch(
      // image_url + manufacturer + region come through so each product entry
      // can carry an <image:image> child AND feed the /brand and /buy
      // programmatic sitemap entries from the same crawl.
      `${supabaseUrl}/rest/v1/products?is_active=eq.true&select=slug,updated_at,image_url,manufacturer,region`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        next: { revalidate: 600 },
      },
    )
    if (!res.ok) return []
    return (await res.json()) as ProductRow[]
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getActiveProducts()
  const now = new Date()

  // Static public routes. /cart, /checkout, /dashboard, /admin, /api,
  // /login, /register, /forgot-password, /reset-password are deliberately
  // excluded - they're blocked in robots.ts.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/rewards`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/compliance`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ]

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => {
    // Build absolute image URL - Supabase storage URLs come back fully
    // qualified, but bundled fallbacks like /images/cqvs-logo.png are
    // relative and need the SITE_URL prefix for sitemap inclusion.
    const rawImage = p.image_url ?? "/images/cqvs-logo.png"
    const absoluteImage = rawImage.startsWith("http")
      ? rawImage
      : `${SITE_URL}${rawImage}`

    return {
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      // images: feeds Google Images discovery - each product photo
      // surfaces under image search results for chemical / pack-size
      // queries (a discovery channel B2B competitors mostly ignore).
      images: [absoluteImage],
    }
  })

  // /brand/[manufacturer-slug] - one entry per unique manufacturer that
  // has at least one active product. Auto-grows as new brands are added.
  const brandSlugs = new Set<string>()
  for (const p of products) {
    if (p.manufacturer) brandSlugs.add(slugify(p.manufacturer))
  }
  const brandRoutes: MetadataRoute.Sitemap = Array.from(brandSlugs).map(
    (slug) => ({
      url: `${SITE_URL}/brand/${slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }),
  )

  // /buy/[product-slug]/[state-slug] - one entry per active product where
  // we have a known dispatch state. Each product page already has its
  // canonical at /products/[slug]; these /buy URLs are geo-qualified
  // landing pages with their own canonical pointing back to themselves.
  // Each entry carries the product image so Google Images can surface
  // the geo-qualified page under "[product] [state]" image queries.
  const buyRoutes: MetadataRoute.Sitemap = products
    .filter((p) => {
      const region = (p.region ?? "").toLowerCase()
      return (STATE_SLUGS as readonly string[]).includes(region)
    })
    .map((p) => {
      const rawImage = p.image_url ?? "/images/cqvs-logo.png"
      const absoluteImage = rawImage.startsWith("http")
        ? rawImage
        : `${SITE_URL}${rawImage}`
      return {
        url: `${SITE_URL}/buy/${p.slug}/${(p.region as string).toLowerCase()}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
        images: [absoluteImage],
      }
    })

  return [...staticRoutes, ...productRoutes, ...brandRoutes, ...buyRoutes]
}
