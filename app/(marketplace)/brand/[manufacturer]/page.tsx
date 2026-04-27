import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, Factory } from "lucide-react"

import { products as staticProducts, type Product } from "@/lib/data/products"
import { ProductCard } from "@/components/products/product-card"
import { JsonLd } from "@/components/seo/json-ld"
import {
  breadcrumbSchema,
  collectionPageSchema,
  faqPageSchema,
  itemListSchema,
} from "@/lib/seo/schema"
import {
  ensureBrandMention,
  meetsContentBar,
  slugify,
  wordCount,
} from "@/lib/seo/helpers"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

interface RouteParams {
  params: Promise<{ manufacturer: string }>
}

interface BrandLookup {
  /** Display name as it appears on products (e.g. "CQVS Chemical"). */
  name: string
  slug: string
  products: Product[]
}

/**
 * Fetch products from Supabase, falling back to the static seed list. Mirrors
 * the resolution logic the PDP uses so brand pages stay consistent with the
 * source of truth at any given moment.
 */
async function getActiveProducts(): Promise<Product[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/products?is_active=eq.true&select=id,name,slug,price,unit,description,manufacturer,category,classification,cas_number,packaging_sizes,safety_info,delivery_info,in_stock,stock_qty,region,image_url,badge`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          next: { revalidate: 600 },
        },
      )
      if (res.ok) {
        const rows = (await res.json()) as Array<Record<string, unknown>>
        if (rows.length > 0) {
          return rows.map((r) => ({
            id: r.id as string,
            name: r.name as string,
            slug: r.slug as string,
            price: r.price as number,
            unit: r.unit as string,
            description: (r.description as string) ?? "",
            manufacturer: (r.manufacturer as string) ?? "",
            category: (r.category as string) ?? "",
            classification: (r.classification as string) ?? "",
            casNumber: (r.cas_number as string) ?? "",
            packagingSizes: (r.packaging_sizes as string[]) ?? [],
            safetyInfo: (r.safety_info as string) ?? "",
            deliveryInfo: (r.delivery_info as string) ?? "",
            inStock: (r.in_stock as boolean) ?? false,
            stockQty: (r.stock_qty as number) ?? 0,
            region: (r.region as string) ?? "",
            image: (r.image_url as string) || "/images/cqvs-logo.png",
            badge: (r.badge as string) ?? undefined,
          }))
        }
      }
    } catch {
      // Fall through to static.
    }
  }
  return staticProducts
}

/**
 * Resolve a `[manufacturer]` URL slug to the matching products. Uses the
 * full active product list so the slug match is computed from live data
 * rather than a hardcoded brand registry - new brands light up
 * automatically as they're added in admin.
 */
async function resolveBrand(slug: string): Promise<BrandLookup | null> {
  const all = await getActiveProducts()
  const matches = all.filter(
    (p) => p.manufacturer && slugify(p.manufacturer) === slug,
  )
  if (matches.length === 0) return null
  return {
    name: matches[0].manufacturer,
    slug,
    products: matches,
  }
}

export async function generateStaticParams() {
  // Pre-render brand pages for every manufacturer present in the seed
  // list. Supabase-only manufacturers will still render correctly via
  // the dynamic resolver - they just don't get a static build artefact.
  const seen = new Set<string>()
  const params: Array<{ manufacturer: string }> = []
  for (const p of staticProducts) {
    if (!p.manufacturer) continue
    const slug = slugify(p.manufacturer)
    if (!seen.has(slug)) {
      seen.add(slug)
      params.push({ manufacturer: slug })
    }
  }
  return params
}

function buildIntro(brand: BrandLookup): string {
  const count = brand.products.length
  const categories = Array.from(
    new Set(brand.products.map((p) => p.category).filter(Boolean)),
  )
  const categoryPhrase =
    categories.length === 0
      ? ""
      : categories.length === 1
        ? `${categories[0].toLowerCase()} products`
        : `${categories.slice(0, -1).join(", ").toLowerCase()} and ${categories.slice(-1)[0].toLowerCase()} products`

  const draft = [
    `Chem Connect stocks ${count} active ${brand.name} ${categoryPhrase || "products"} for B2B buyers across Australia.`,
    `Every ${brand.name} item ships manufacturer-direct with live AUD pricing, GST-inclusive invoicing, and DG-rated freight where required.`,
    `Use the grid below to browse the full ${brand.name} range, or contact our team for a tailored quote on bulk volumes.`,
  ].join(" ")
  // Idempotent guard so any future wording change can't accidentally
  // drop the brand mention out of the AI citation window.
  return ensureBrandMention(draft, `${brand.name} products to Australian B2B buyers`)
}

function buildBrandFaqs(
  brand: BrandLookup,
): Array<{ question: string; answer: string }> {
  const dgCount = brand.products.filter(
    (p) => p.classification && p.classification !== "Non-DG",
  ).length

  return [
    {
      question: `Where can I buy ${brand.name} products in Australia?`,
      answer: `${brand.name} products are available manufacturer-direct from Chem Connect with dispatch hubs across NSW, VIC, QLD, SA and WA. Prices are listed in AUD and orders ship within 1 business day of payment.`,
    },
    {
      question: `Are ${brand.name} prices GST-inclusive?`,
      answer:
        "Prices are listed in AUD on the marketplace. GST is shown as a separate line in the cart. Invoices are tax-compliant for ABN-holding Australian businesses.",
    },
    {
      question: `Does Chem Connect ship ${brand.name} dangerous goods?`,
      answer:
        dgCount > 0
          ? `Yes - ${dgCount} of the listed ${brand.name} products are classified dangerous goods. They ship through approved Australian DG-rated freight carriers compliant with the ADG Code.`
          : `Every listed ${brand.name} product is non-DG and ships through standard freight without ADG-rated handling.`,
    },
    {
      question: `Can I order custom pack sizes of ${brand.name} products?`,
      answer: `Custom pack sizes can be sourced via the Custom Orders form. Standard sizes are listed on each product page; bulk volumes (drums, IBCs, custom-fill) are available on request.`,
    },
  ]
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { manufacturer } = await params
  const brand = await resolveBrand(manufacturer)
  if (!brand) {
    return { title: "Brand Not Found", robots: { index: false, follow: false } }
  }

  const title = `${brand.name} | Buy in Bulk Across Australia`
  const description = `Browse the full ${brand.name} range on Chem Connect. ${brand.products.length} active products, manufacturer-direct AUD pricing, GST-inclusive, DG-rated freight where required.`
  const url = `${SITE_URL}/brand/${brand.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "Chem Connect",
      locale: "en_AU",
      title,
      description,
      images: [
        {
          url: `${SITE_URL}/images/cqvs-logo.png`,
          width: 1200,
          height: 630,
          alt: `${brand.name} on Chem Connect Australia`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/images/cqvs-logo.png`],
    },
  }
}

export default async function BrandPage({ params }: RouteParams) {
  const { manufacturer } = await params
  const brand = await resolveBrand(manufacturer)
  if (!brand) notFound()

  const intro = buildIntro(brand)

  // Thin-content guard. A brand page that lists fewer than the threshold
  // products with a barely-there intro hurts more than it helps - prefer
  // a 404 so the URL stays clean for re-launch when the range grows.
  if (
    !meetsContentBar({
      productCount: brand.products.length,
      introWordCount: wordCount(intro),
      // Allow a brand to ship with as few as 1 product since some
      // exclusive distribution deals legitimately start small.
      minProducts: 1,
      minIntroWords: 60,
    })
  ) {
    notFound()
  }

  const url = `${SITE_URL}/brand/${brand.slug}`
  const itemList = brand.products.map((p) => ({
    name: p.name,
    url: `${SITE_URL}/products/${p.slug}`,
  }))
  const faqs = buildBrandFaqs(brand)

  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-brand-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Products", url: `${SITE_URL}/products` },
          { name: brand.name, url },
        ])}
      />
      <JsonLd
        id="ld-brand-collection"
        schema={collectionPageSchema({
          url,
          name: `${brand.name} - Industrial chemicals on Chem Connect`,
          description: intro,
          items: itemList,
        })}
      />
      <JsonLd
        id="ld-brand-itemlist"
        schema={itemListSchema({
          name: `${brand.name} products`,
          items: itemList,
        })}
      />
      <JsonLd id="ld-brand-faq" schema={faqPageSchema(faqs)} />

      <header className="mb-10">
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <Factory className="size-3.5" />
          Brand
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          <span className="text-primary">{brand.name}</span>
          <span className="text-foreground"> on Chem Connect</span>
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">{intro}</p>
      </header>

      <section className="mb-14">
        <h2 className="mb-5 text-xl font-bold tracking-tight">
          Browse the {brand.name} range
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {brand.products.map((p) => (
            <ProductCard
              key={p.id}
              id={p.id}
              name={p.name}
              slug={p.slug}
              price={p.price}
              unit={p.unit}
              manufacturer={p.manufacturer}
              classification={p.classification}
              inStock={p.inStock}
              packagingSizes={p.packagingSizes}
              badge={p.badge ?? null}
              image={p.image}
            />
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-3 text-xl font-bold tracking-tight">
          {brand.name} - frequently asked
        </h2>
        <div className="space-y-3">
          {faqs.map((f) => (
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

      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight">
          Need a {brand.name} product not listed?
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Custom pack sizes, bulk volumes, or special-order items can be
          quoted on demand. Submit a Custom Order request and our team will
          come back to you with availability and pricing.
        </p>
        <Link
          href="/custom-orders"
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Request a custom {brand.name} quote
          <ArrowRight className="size-3.5" />
        </Link>
      </section>
    </main>
  )
}
