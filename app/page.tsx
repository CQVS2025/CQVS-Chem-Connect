import { FadeIn } from "@/components/shared/motion"
import { Sparkles } from "lucide-react"

import { products } from "@/lib/data/products"
import { MarketplaceNavbar } from "@/components/layouts/marketplace-navbar"
import { MarketplaceFooter } from "@/components/layouts/marketplace-footer"
import { ProductRequestForm } from "@/components/shared/product-request-form"

import { LandingHero, type HeroProduct } from "@/components/landing/landing-hero"
import { LivePricingStrip } from "@/components/landing/live-pricing-strip"
import { HowItWorks } from "@/components/landing/how-it-works"
import { WhyBento } from "@/components/landing/why-bento"
import { FinalCta } from "@/components/landing/final-cta"

export const metadata = {
  title:
    "Chem Connect - Manufacturing-direct chemicals for concrete plants & quarries",
  description:
    "Australian B2B chemical marketplace. Skip the middleman, see live pricing, and get bulk chemicals delivered in 2-5 days from your state. Free to join, no card required.",
}

// ============================================================
// Server-side data
// ============================================================

interface FeaturedProduct {
  id: string
  name: string
  slug: string
  price: number
  unit: string
  manufacturer: string
  category: string
  badge: string | null
  image: string | null
}

function mapProductRow(p: Record<string, unknown>): FeaturedProduct {
  return {
    id: p.id as string,
    name: p.name as string,
    slug: p.slug as string,
    price: p.price as number,
    unit: p.unit as string,
    manufacturer: p.manufacturer as string,
    category: p.category as string,
    badge: (p.badge as string) || null,
    image: (p.image_url as string) || null,
  }
}

async function supabaseFetch(path: string): Promise<unknown[] | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return (await res.json()) as unknown[]
  } catch {
    return null
  }
}

async function getLandingSelections(): Promise<{
  hero: string[]
  featured: string[]
}> {
  const rows = await supabaseFetch(
    "landing_featured?select=section,position,product_id&order=section.asc,position.asc",
  )
  if (!rows) return { hero: [], featured: [] }

  const hero: string[] = []
  const featured: string[] = []
  for (const row of rows as {
    section: string
    product_id: string
  }[]) {
    if (row.section === "hero") hero.push(row.product_id)
    else if (row.section === "featured") featured.push(row.product_id)
  }
  return { hero, featured }
}

async function getProductsByIds(ids: string[]): Promise<FeaturedProduct[]> {
  if (ids.length === 0) return []
  const idList = ids.map((id) => `"${id}"`).join(",")
  const rows = await supabaseFetch(
    `products?select=id,name,slug,price,unit,manufacturer,category,badge,image_url&id=in.(${idList})&is_active=eq.true`,
  )
  if (!rows) return []

  const byId = new Map<string, FeaturedProduct>()
  for (const row of rows as Record<string, unknown>[]) {
    const mapped = mapProductRow(row)
    byId.set(mapped.id, mapped)
  }
  // Preserve admin-chosen order.
  return ids.map((id) => byId.get(id)).filter((p): p is FeaturedProduct => !!p)
}

async function getFallbackProducts(limit: number): Promise<FeaturedProduct[]> {
  const rows = await supabaseFetch(
    `products?select=id,name,slug,price,unit,manufacturer,category,badge,image_url&is_active=eq.true&order=name.asc&limit=${limit}`,
  )
  if (rows && rows.length > 0) {
    return (rows as Record<string, unknown>[]).map(mapProductRow)
  }

  return products.slice(0, limit).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    unit: p.unit,
    manufacturer: p.manufacturer,
    category: p.category,
    badge: p.badge ?? null,
    image: p.image ?? null,
  }))
}

const STATE_ROTATION = ["NSW", "VIC", "QLD", "WA", "SA", "TAS"]

function toHeroTickerProducts(items: FeaturedProduct[]): HeroProduct[] {
  return items.slice(0, 3).map((p, i) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    unit: p.unit,
    image: p.image,
    state: STATE_ROTATION[i % STATE_ROTATION.length],
    inStock: 18 + ((p.id.charCodeAt(0) || 0) % 24),
  }))
}

// ============================================================
// Page
// ============================================================

export default async function HomePage() {
  const selections = await getLandingSelections()

  const [heroPicked, featuredPicked] = await Promise.all([
    getProductsByIds(selections.hero),
    getProductsByIds(selections.featured),
  ])

  // Fall back to a default list so the page never renders empty
  // before the admin has made any selections.
  const fallback = await getFallbackProducts(6)
  const featured =
    featuredPicked.length > 0 ? featuredPicked : fallback.slice(0, 6)
  const heroBase =
    heroPicked.length > 0
      ? heroPicked
      : [...fallback].sort((a, b) => a.price - b.price)
  const heroTicker = toHeroTickerProducts(heroBase)

  return (
    <div className="flex min-h-svh flex-col">
      <MarketplaceNavbar />

      {/* 1. Hero with live price ticker */}
      <LandingHero tickerProducts={heroTicker} />

      {/* 4. Live pricing - replaces "Featured Products" */}
      <LivePricingStrip products={featured} />

      {/* 5. How it works (3 steps, not 4) */}
      <HowItWorks />

      {/* 6. Why Chem Connect - bento grid */}
      <WhyBento />

      {/* 8. Request a product */}
      <section className="border-t border-border/60 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/8 via-card to-card p-10 sm:p-14">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl"
              />

              <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Product Requests
                  </span>

                  <h2 className="mt-5 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
                    Don&apos;t see what you{" "}
                    <span className="text-primary">need</span>?
                  </h2>
                  <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                    Tell us what chemical you&apos;re looking for and we&apos;ll
                    source it from our manufacturer network.
                  </p>

                  <ul className="mt-6 grid gap-2.5 text-sm">
                    {[
                      "Sourced direct from our manufacturer network",
                      "Competitive bulk pricing on custom requests",
                      "Fast turnaround, typically within 48 hours",
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                          ✓
                        </span>
                        <span className="text-muted-foreground">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex w-full shrink-0 flex-col items-start gap-3 lg:w-auto lg:items-end">
                  <ProductRequestForm />
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 9. Final CTA */}
      <FinalCta />

      <MarketplaceFooter />
    </div>
  )
}
