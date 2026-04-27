import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { ArrowRight, MapPin, Package, ShieldCheck, Truck } from "lucide-react"

import {
  getProductBySlug,
  products as staticProducts,
  type Product,
} from "@/lib/data/products"
import { JsonLd } from "@/components/seo/json-ld"
import {
  breadcrumbSchema,
  faqPageSchema,
  productSchema,
} from "@/lib/seo/schema"
import {
  STATE_NAMES,
  getWarehousesByState,
  type WarehouseLocation,
} from "@/lib/seo/warehouses"
import {
  deriveImageAlt,
  ensureBrandMention,
  meetsContentBar,
  wordCount,
} from "@/lib/seo/helpers"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

const STATE_SLUGS = ["nsw", "vic", "qld", "sa", "wa"] as const
type StateSlug = (typeof STATE_SLUGS)[number]

function isValidStateSlug(s: string): s is StateSlug {
  return (STATE_SLUGS as readonly string[]).includes(s)
}

interface RouteParams {
  params: Promise<{ product: string; state: string }>
}

/**
 * Live product fetch - mirrors the PDP resolver so /buy pages stay in sync
 * with the source of truth. Falls back to the seed list when Supabase
 * isn't configured (preview / local dev).
 */
async function getProduct(slug: string): Promise<Product | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=id,name,slug,price,unit,description,manufacturer,category,classification,cas_number,packaging_sizes,safety_info,delivery_info,in_stock,stock_qty,region,image_url,badge&limit=1`,
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
        const r = rows[0]
        if (r) {
          return {
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
          }
        }
      }
    } catch {
      // Fall through to static.
    }
  }
  return getProductBySlug(slug) ?? null
}

/**
 * Pre-render only the product / state combinations where the product is
 * stocked locally in that state. Other combinations resolve dynamically
 * and either render (if interstate dispatch is plausible) or 404 via the
 * thin-content guard.
 */
export function generateStaticParams() {
  const params: Array<{ product: string; state: string }> = []
  for (const p of staticProducts) {
    if (!p.region) continue
    const state = p.region.toLowerCase()
    if (isValidStateSlug(state)) {
      params.push({ product: p.slug, state })
    }
  }
  return params
}

function pickWarehouseForState(
  state: keyof typeof STATE_NAMES,
): WarehouseLocation | null {
  const local = getWarehousesByState(state)
  return local[0] ?? null
}

function buildIntro(
  product: Product,
  stateName: string,
  warehouse: WarehouseLocation | null,
  isLocalStock: boolean,
): string {
  const dispatchPhrase = warehouse
    ? `dispatched from our Chem Connect ${warehouse.city} hub at ${warehouse.suburb} ${warehouse.state}`
    : `dispatched from the closest interstate Chem Connect hub`

  const transitPhrase = isLocalStock
    ? `Most ${stateName} metro orders arrive within 2-4 business days`
    : `Most ${stateName} metro orders arrive within 4-7 business days from interstate dispatch`

  const draft = [
    `Buy ${product.name} in ${stateName}, ${dispatchPhrase}.`,
    product.description,
    `${transitPhrase} on standard freight, with DG-rated carriers used where the product classification requires it.`,
    `Live AUD pricing, GST-inclusive, ABN invoicing - no quote forms, no surprises.`,
  ]
    .filter(Boolean)
    .join(" ")

  // Idempotent. Guarantees the brand name lands inside the 100-word AI
  // citation window even if the warehouse + product fields together
  // didn't mention "Chem Connect" early enough.
  return ensureBrandMention(
    draft,
    `${product.category || "industrial chemicals"} to ${stateName} buyers`,
  )
}

function buildFaqs(
  product: Product,
  stateName: string,
  stateCode: string,
  warehouse: WarehouseLocation | null,
): Array<{ question: string; answer: string }> {
  const dispatchAnswer = warehouse
    ? `${product.name} ships from our ${warehouse.city} hub at ${warehouse.street}, ${warehouse.suburb} ${warehouse.state} ${warehouse.postcode}.`
    : `${product.name} ships to ${stateName} from the closest interstate Chem Connect hub. Per-state lead times are listed on the product page.`

  return [
    {
      question: `Where does ${product.name} ship from for ${stateName} (${stateCode}) buyers?`,
      answer: dispatchAnswer,
    },
    {
      question: `How long does ${product.name} take to arrive in ${stateName}?`,
      answer: `Most ${stateName} metro orders arrive within 2-4 business days. Regional and remote ${stateCode} addresses typically take 4-7 business days. DG-classified shipments may add 1-2 days for compliant carrier handling.`,
    },
    {
      question: `Is ${product.name} ${product.classification === "Non-DG" ? "non-DG" : `classified ${product.classification}`} for transport?`,
      answer:
        product.classification === "Non-DG"
          ? `${product.name} is non-DG and ships through standard freight without ADG-rated handling.`
          : `${product.name} is classified ${product.classification}. It ships through approved Australian DG-rated freight carriers compliant with the ADG Code.`,
    },
    {
      question: `What pack sizes are available in ${stateName}?`,
      answer:
        product.packagingSizes && product.packagingSizes.length > 0
          ? `${product.name} is available in ${product.packagingSizes.join(", ")}. Custom sizes can be sourced via the Custom Orders form.`
          : `Standard pack sizes for ${product.name} are listed on the product page. Custom sizes available via Custom Orders.`,
    },
  ]
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { product: productSlug, state } = await params
  if (!isValidStateSlug(state)) {
    return { title: "Not Found", robots: { index: false, follow: false } }
  }
  const product = await getProduct(productSlug)
  if (!product) {
    return { title: "Not Found", robots: { index: false, follow: false } }
  }

  const stateCode = state.toUpperCase() as keyof typeof STATE_NAMES
  const stateName = STATE_NAMES[stateCode]

  const title = `Buy ${product.name} in ${stateName} (${stateCode}) | Chem Connect`
  const description = `${product.name} for ${stateName} buyers - manufacturer-direct AUD pricing, GST-inclusive, fast local dispatch from Chem Connect's ${stateCode} freight network.`
  const url = `${SITE_URL}/buy/${product.slug}/${state}`
  const absoluteImage = product.image.startsWith("http")
    ? product.image
    : `${SITE_URL}${product.image}`

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
          url: absoluteImage,
          width: 1200,
          height: 630,
          alt: deriveImageAlt({
            name: product.name,
            category: product.category,
            manufacturer: product.manufacturer,
            qualifier: stateName,
          }),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteImage],
    },
  }
}

export default async function BuyProductInStatePage({ params }: RouteParams) {
  const { product: productSlug, state } = await params
  if (!isValidStateSlug(state)) notFound()

  const product = await getProduct(productSlug)
  if (!product) notFound()

  const stateCode = state.toUpperCase() as keyof typeof STATE_NAMES
  const stateName = STATE_NAMES[stateCode]
  const isLocalStock = (product.region ?? "").toUpperCase() === stateCode
  const warehouse = pickWarehouseForState(stateCode)
  const intro = buildIntro(product, stateName, warehouse, isLocalStock)

  // Thin-content guard. The intro auto-builds from product fields, so the
  // word count grows with description quality. If a product has only a
  // one-liner description, we'd rather 404 here than ship a thin page.
  if (
    !meetsContentBar({
      productCount: 1,
      introWordCount: wordCount(intro),
      minProducts: 1,
      minIntroWords: 90,
    })
  ) {
    notFound()
  }

  const url = `${SITE_URL}/buy/${product.slug}/${state}`
  const faqs = buildFaqs(product, stateName, stateCode, warehouse)

  // The product schema for this page uses the same shape as the canonical
  // PDP - Google handles duplicate Product schema across pages without
  // penalising as long as the canonical URL on the PDP points back to
  // /products/[slug]. The /buy variant adds geo context via FAQs.
  const productLd = productSchema({
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    unit: product.unit,
    manufacturer: product.manufacturer,
    category: product.category,
    classification: product.classification,
    casNumber: product.casNumber,
    inStock: product.inStock,
    image: product.image,
    baseUrl: SITE_URL,
  })

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd id="ld-buy-product" schema={productLd} />
      <JsonLd
        id="ld-buy-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Locations", url: `${SITE_URL}/locations` },
          {
            name: stateName,
            url: `${SITE_URL}/chemicals/${state}`,
          },
          { name: product.name, url },
        ])}
      />
      <JsonLd id="ld-buy-faq" schema={faqPageSchema(faqs)} />

      <header className="mb-10">
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <MapPin className="size-3.5" />
          {stateName} ({stateCode})
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Buy <span className="text-primary">{product.name}</span> in{" "}
          {stateName}
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">{intro}</p>
      </header>

      <section className="mb-12 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="mb-4 flex items-start gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-white">
              <Image
                src={product.image || "/images/cqvs-logo.png"}
                alt={deriveImageAlt({
                  name: product.name,
                  category: product.category,
                  manufacturer: product.manufacturer,
                  qualifier: stateName,
                })}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold tracking-tight">
                {product.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {product.manufacturer} - {product.category}
              </p>
              <p className="mt-2 text-2xl font-bold text-primary">
                AUD {product.price.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / {product.unit}
                </span>
              </p>
            </div>
          </div>

          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          <Link
            href={`/products/${product.slug}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View product details &amp; order
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Truck className="size-3.5" />
              Dispatch hub
            </div>
            {warehouse ? (
              <div className="mt-2">
                <p className="font-semibold">{warehouse.city}</p>
                <p className="text-sm text-muted-foreground">
                  {warehouse.street}
                  <br />
                  {warehouse.suburb} {warehouse.state} {warehouse.postcode}
                </p>
                <Link
                  href={`/chemical-supplier/${warehouse.slug}`}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2"
                >
                  View {warehouse.city} hub
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Closest interstate Chem Connect hub.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Package className="size-3.5" />
              Pack sizes
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(product.packagingSizes && product.packagingSizes.length > 0
                ? product.packagingSizes
                : ["Standard sizes - see product page"]
              ).map((size) => (
                <li key={size} className="text-muted-foreground">
                  {size}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="size-3.5" />
              DG status
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {product.classification}
            </p>
          </div>
        </aside>
      </section>

      <section className="mb-12">
        <h2 className="mb-3 text-xl font-bold tracking-tight">
          {stateName} buyers - frequently asked
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
          Browse more {stateName} stock
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          See every product available for fast {stateCode} dispatch.
        </p>
        <Link
          href={`/chemicals/${state}`}
          className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {stateName} catalogue
          <ArrowRight className="size-3.5" />
        </Link>
      </section>
    </main>
  )
}
