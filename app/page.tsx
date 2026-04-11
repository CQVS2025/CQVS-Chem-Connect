import { ScaleIn } from "@/components/shared/motion"
import { CheckCircle } from "lucide-react"

import { products } from "@/lib/data/products"
import { MarketplaceNavbar } from "@/components/layouts/marketplace-navbar"
import { MarketplaceFooter } from "@/components/layouts/marketplace-footer"
import { ProductRequestForm } from "@/components/shared/product-request-form"

import { LandingHero, type HeroProduct } from "@/components/landing/landing-hero"
import { LogoBar } from "@/components/landing/logo-bar"
import { NumbersStrip } from "@/components/landing/numbers-strip"
import { LivePricingStrip } from "@/components/landing/live-pricing-strip"
import { HowItWorks } from "@/components/landing/how-it-works"
import { WhyBento } from "@/components/landing/why-bento"
import { FoundingMember } from "@/components/landing/founding-member"
import { FinalCta } from "@/components/landing/final-cta"

export const metadata = {
  title:
    "Chem Connect — Manufacturing-direct chemicals for concrete plants & quarries",
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

async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/products?select=id,name,slug,price,unit,manufacturer,category,badge,image_url&order=name.asc&limit=6`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          next: { revalidate: 60 },
        },
      )
      if (res.ok) {
        const rows = await res.json()
        if (rows.length > 0) {
          return rows.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            slug: p.slug as string,
            price: p.price as number,
            unit: p.unit as string,
            manufacturer: p.manufacturer as string,
            category: p.category as string,
            badge: (p.badge as string) || null,
            image: (p.image_url as string) || null,
          }))
        }
      }
    } catch {
      // Fall through to static
    }
  }

  return products.slice(0, 6).map((p) => ({
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

function buildHeroTickerProducts(featured: FeaturedProduct[]): HeroProduct[] {
  // Pick the 3 cheapest products as the hero ticker — they show off the
  // "lowest price" angle and rotate every 4 seconds in the hero card.
  return [...featured]
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map((p, i) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      unit: p.unit,
      image: p.image,
      // Rotate AU states purely for visual variety in the demo card.
      // (Real per-warehouse stock would come from product_warehouses join.)
      state: STATE_ROTATION[i % STATE_ROTATION.length],
      inStock: 18 + ((p.id.charCodeAt(0) || 0) % 24),
    }))
}

// ============================================================
// Page
// ============================================================

export default async function HomePage() {
  const featured = await getFeaturedProducts()
  const heroTicker = buildHeroTickerProducts(featured)

  return (
    <div className="flex min-h-svh flex-col">
      <MarketplaceNavbar />

      {/* 1. Hero with live price ticker */}
      <LandingHero tickerProducts={heroTicker} />

      {/* 2. Logo / partner bar */}
      <LogoBar />

      {/* 3. Numbers strip */}
      <NumbersStrip />

      {/* 4. Live pricing — replaces "Featured Products" */}
      <LivePricingStrip products={featured} />

      {/* 5. How it works (3 steps, not 4) */}
      <HowItWorks />

      {/* 6. Why Chem Connect — bento grid */}
      <WhyBento />

      {/* 7. Founding member callout (honest social proof) */}
      <FoundingMember />

      {/* 8. Request a product (existing form, restyled wrapper) */}
      <section className="border-t border-border/60 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <ScaleIn className="mx-auto max-w-2xl text-center">
          <div className="rounded-3xl border border-border/60 bg-card p-10 sm:p-12">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <CheckCircle className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">
              Don&apos;t see what you need?
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Tell us what chemical you&apos;re looking for and we&apos;ll source
              it from our manufacturer network.
            </p>
            <ProductRequestForm />
          </div>
        </ScaleIn>
      </section>

      {/* 9. Final CTA */}
      <FinalCta />

      <MarketplaceFooter />
    </div>
  )
}
