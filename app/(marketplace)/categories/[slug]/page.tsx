import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArrowRight, ChevronRight } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { JsonLd } from "@/components/seo/json-ld"
import {
  breadcrumbSchema,
  collectionPageSchema,
  faqPageSchema,
} from "@/lib/seo/schema"
import {
  categories as categoriesList,
  products as staticProducts,
} from "@/lib/data/products"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

/**
 * Category metadata bank - slug → human-readable details. The slug list
 * mirrors `categories` from lib/data/products.ts; if a new category is
 * added there, add an entry here too. Anything missing falls back to a
 * generic title pattern but ranks weaker.
 */
const CATEGORY_INFO: Record<
  string,
  {
    label: string
    intro: string
    useCases: string[]
    faqs: Array<{ question: string; answer: string }>
  }
> = {
  "acid-replacement": {
    label: "Acid Replacement",
    intro:
      "Acid-replacement chemicals strip concrete, brick, and metal residue without the OH&S overhead of strong mineral acids. Lower hazard class, easier handling, fully effective for most concrete-plant cleaning duties.",
    useCases: [
      "Truck-mixer residue removal",
      "Concrete plant equipment cleaning",
      "Quarry plant scale removal",
      "Construction site clean-down",
    ],
    faqs: [
      {
        question: "Why use an acid replacement instead of hydrochloric acid?",
        answer:
          "Acid-replacement chemicals deliver the same scale-removal performance as HCl with significantly reduced fume, lower hazard class for transport (often non-DG), and gentler effect on stainless and mild steel. They're safer to store, ship, and handle while still meeting heavy-duty concrete-plant cleaning needs.",
      },
      {
        question: "Are acid-replacement products dangerous goods?",
        answer:
          "Most acid-replacement chemicals stocked on Chem Connect are non-DG or low-hazard. The exact classification, UN number (where applicable), and packaging group are listed on each product page.",
      },
    ],
  },
  acid: {
    label: "Acid",
    intro:
      "Industrial-grade acids for descaling, cleaning, etching, and pH adjustment. Manufacturer-direct from Australian suppliers with full ADG-compliant freight.",
    useCases: [
      "Concrete and mortar removal",
      "Stainless-steel passivation",
      "pH adjustment in process water",
      "Scale removal in heat exchangers",
    ],
    faqs: [
      {
        question: "How are acids shipped within Australia?",
        answer:
          "Industrial acids are dangerous goods (DG) and ship through approved ADG Code-compliant carriers. Standard pack sizes are 5 L, 20 L, 200 L drum, and 1,000 L IBC. Some grades have state-specific transport restrictions, flagged on each product page.",
      },
      {
        question: "Do you carry food-grade acids?",
        answer:
          "Some acids are available in food / pharma grade through our Custom Orders process. Submit a request via /custom-orders with your required spec.",
      },
    ],
  },
  alkali: {
    label: "Alkali",
    intro:
      "Caustic and alkaline chemicals for industrial cleaning, pH neutralisation, water treatment, and process chemistry. Manufacturer-direct AUD pricing.",
    useCases: [
      "Heavy-duty industrial degreasing",
      "Water-treatment pH adjustment",
      "CIP (clean-in-place) for food / bev",
      "Soap and detergent production",
    ],
    faqs: [
      {
        question: "What pack sizes are available for caustic soda?",
        answer:
          "Standard pack sizes are 25 kg poly bag (flake), 5 L liquid, 20 L liquid, 200 L drum, and 1,000 L IBC. Bulk tankers are available through Custom Orders.",
      },
      {
        question: "Are alkalis classed as dangerous goods?",
        answer:
          "Most concentrated alkalis are DG Class 8 (Corrosive). Diluted versions and cleaning blends are often non-DG. Each product page lists the exact UN number, hazard class, and packaging group.",
      },
    ],
  },
  automotive: {
    label: "Automotive",
    intro:
      "Industrial automotive chemicals - workshop cleaners, brake-parts cleaners, AdBlue (DEF), and specialty fluids supplied direct from Australian manufacturers.",
    useCases: [
      "Workshop floor and equipment cleaning",
      "Diesel exhaust fluid (AdBlue) supply",
      "Brake-parts and engine-bay cleaning",
      "Tyre-fitting bay maintenance",
    ],
    faqs: [
      {
        question: "Is AdBlue / DEF on the marketplace?",
        answer:
          "Yes. AdBlue (Diesel Exhaust Fluid) is stocked in 5 L, 10 L, 20 L, and IBC pack sizes - meeting ISO 22241 specification.",
      },
      {
        question: "Can I buy automotive chemicals as a single workshop?",
        answer:
          "Yes. Chem Connect requires a valid ABN - single workshops, fleets, and dealerships all qualify.",
      },
    ],
  },
  cleaning: {
    label: "Cleaning",
    intro:
      "Industrial cleaning chemicals - degreasers, sanitisers, solvent washes, and specialty cleaners for concrete plants, quarries, manufacturing sites, and food / bev facilities.",
    useCases: [
      "Heavy-equipment degreasing",
      "Floor and high-pressure cleaning",
      "Plant sanitation and CIP",
      "Workshop and fleet wash-down",
    ],
    faqs: [
      {
        question: "Are food-grade cleaners available?",
        answer:
          "Yes - food-grade and CIP-rated cleaners are listed in the catalogue with the relevant compliance notes (HACCP-compatible, NSF-rated where applicable).",
      },
      {
        question: "What's the most-ordered cleaning chemical?",
        answer:
          "Concrete and quarry sites order high volumes of acid-replacement truck-wash and heavy-duty alkaline degreaser. See the products list for current pricing.",
      },
    ],
  },
  "personal-care": {
    label: "Personal Care",
    intro:
      "Personal-care raw materials and intermediates - surfactants, glycerin, glycols, emulsifiers - sold as bulk industrial inputs to formulators.",
    useCases: [
      "Soap and detergent formulation",
      "Cosmetic / personal-care raw materials",
      "Hand-sanitiser production",
      "Lubricant blending",
    ],
    faqs: [
      {
        question: "Do you sell to small / boutique formulators?",
        answer:
          "Yes - any ABN-holding business can buy. Pack sizes start at 5 L for most products.",
      },
      {
        question: "Are pharma-grade ingredients available?",
        answer:
          "Selected ingredients are available in pharma / USP / BP grade through our Custom Orders process.",
      },
    ],
  },
}

/**
 * Convert a stored category label (e.g. "Acid Replacement") to a URL slug.
 * Mirrors the convention used in CATEGORY_INFO keys.
 */
function categoryToSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "-")
}

interface RouteParams {
  params: Promise<{ slug: string }>
}

/**
 * One page per real category from lib/data/products.ts. Skips the "All"
 * pseudo-category - that's just the unfiltered catalogue at /products.
 */
export function generateStaticParams() {
  return categoriesList
    .filter((c) => c !== "All")
    .map((c) => ({ slug: categoryToSlug(c) }))
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params
  const info = CATEGORY_INFO[slug]
  const labelGuess = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
  const label = info?.label ?? labelGuess

  const title = `Buy ${label} Online Australia - Bulk Pricing`
  const description =
    info?.intro?.slice(0, 158) ||
    `Manufacturer-direct ${label.toLowerCase()} chemicals across Australia. Live AUD pricing, GST-inclusive, DG-rated freight from local Chem Connect hubs.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/categories/${slug}` },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/categories/${slug}`,
      siteName: "Chem Connect",
      locale: "en_AU",
      title: `${label} · Chem Connect`,
      description,
      images: [
        {
          url: `${SITE_URL}/images/cqvs-logo.png`,
          width: 1200,
          height: 630,
          alt: `${label} chemicals Australia`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${label} · Chem Connect`,
      description,
      images: [`${SITE_URL}/images/cqvs-logo.png`],
    },
  }
}

interface ProductRow {
  id: string
  name: string
  slug: string
  price: number
  unit: string
  manufacturer: string
  classification: string
  category: string
  in_stock: boolean
  packaging_sizes: string[]
  image_url: string | null
  badge: string | null
}

async function getActiveByCategory(category: string): Promise<ProductRow[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return []

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/products?is_active=eq.true&category=eq.${encodeURIComponent(category)}&select=id,name,slug,price,unit,manufacturer,classification,category,in_stock,packaging_sizes,image_url,badge&order=name.asc`,
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

export default async function CategoryPage({ params }: RouteParams) {
  const { slug } = await params
  const info = CATEGORY_INFO[slug]
  // Look up the original mixed-case category label by reversing the slug
  // back through the source list.
  const originalLabel = categoriesList.find(
    (c) => categoryToSlug(c) === slug,
  )
  if (!originalLabel) notFound()
  const label = info?.label ?? originalLabel

  // Fetch live products in this category, fall back to static catalogue
  // when Supabase isn't reachable.
  const liveProducts = await getActiveByCategory(originalLabel)
  const products =
    liveProducts.length > 0
      ? liveProducts
      : staticProducts
          .filter((p) => p.category === originalLabel)
          .map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            unit: p.unit,
            manufacturer: p.manufacturer,
            classification: p.classification,
            category: p.category,
            in_stock: p.inStock,
            packaging_sizes: p.packagingSizes,
            image_url: p.image,
            badge: p.badge ?? null,
          }))

  const productItems = products.map((p) => ({
    name: p.name,
    url: `${SITE_URL}/products/${p.slug}`,
  }))

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-category-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Products", url: `${SITE_URL}/products` },
          { name: label, url: `${SITE_URL}/categories/${slug}` },
        ])}
      />
      <JsonLd
        id="ld-category-collection"
        schema={collectionPageSchema({
          url: `${SITE_URL}/categories/${slug}`,
          name: `${label} - Chem Connect`,
          description:
            info?.intro ?? `${label} industrial chemicals across Australia.`,
          items: productItems,
        })}
      />
      {info && info.faqs.length > 0 && (
        <JsonLd id="ld-category-faq" schema={faqPageSchema(info.faqs)} />
      )}

      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/products" className="hover:text-foreground">
          Products
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{label}</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          {label}{" "}
          <span className="text-primary">chemicals Australia</span>
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          {info?.intro ??
            `Manufacturer-direct ${label.toLowerCase()} chemicals across Australia. Live AUD pricing, GST-inclusive, DG-rated freight from local Chem Connect hubs.`}
        </p>
      </header>

      {info && (
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-bold tracking-tight">
            Common applications
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {info.useCases.map((u) => (
              <li
                key={u}
                className="rounded-md border border-border/40 bg-card px-3 py-2 text-sm text-muted-foreground"
              >
                {u}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-bold tracking-tight">
          {label} products{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({products.length})
          </span>
        </h2>
        {products.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
            No active products in this category right now. Browse the{" "}
            <Link href="/products" className="text-primary hover:underline">
              full catalogue
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.slug}`}
                className="group block"
              >
                <Card className="h-full overflow-hidden border-border/60 transition-colors hover:border-primary/40">
                  <div className="relative aspect-[5/4] overflow-hidden bg-white">
                    <Image
                      src={p.image_url || "/images/cqvs-logo.png"}
                      alt={`${p.name} - ${p.manufacturer ?? "Chem Connect"} · ${label} Australia`}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold tracking-tight group-hover:text-primary">
                      {p.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.manufacturer}
                    </p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-xl font-black text-primary">
                        AUD {p.price.toFixed(2)}
                      </span>
                      <span className="text-xs text-primary/80">
                        /{p.unit}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge
                        variant={
                          p.classification === "Non-DG"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-[10px]"
                      >
                        {p.classification}
                      </Badge>
                      {p.in_stock && (
                        <Badge className="bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                          In stock
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {info && info.faqs.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-3 text-xl font-bold tracking-tight">FAQs</h2>
          <div className="space-y-3">
            {info.faqs.map((f) => (
              <details
                key={f.question}
                className="group rounded-lg border border-border/60 bg-card p-4"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  {f.question}
                </summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight">
          Don&rsquo;t see what you need?
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          We can source most chemicals through our manufacturer partners.
        </p>
        <Button className="mt-5" asChild>
          <Link href="/custom-orders">
            Submit a custom order <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </section>
    </main>
  )
}
