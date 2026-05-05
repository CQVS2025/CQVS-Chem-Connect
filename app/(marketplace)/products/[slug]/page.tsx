import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Package,
  Truck,
} from "lucide-react"

import { getProductBySlug, products as staticProducts } from "@/lib/data/products"
import {
  getApprovedReviewAggregate,
  getApprovedReviewsForProduct,
  getReviewsForDisplay,
} from "@/lib/reviews/queries"
import { ProductReviews } from "@/components/products/product-reviews"
import { ProductReviewsSummary } from "@/components/products/product-reviews-summary"

// Global kill-switch - if NEXT_PUBLIC_REVIEWS_VISIBLE === "false" we don't
// emit JSON-LD review data nor render the reviews block, regardless of how
// many approved reviews exist. Belt + braces alongside the per-product
// >=3-approved-reviews gate enforced below.
const REVIEWS_KILL_SWITCH_ON =
  process.env.NEXT_PUBLIC_REVIEWS_VISIBLE !== "false"

// Minimum approved reviews before AggregateRating + Review[] are spliced
// into the JSON-LD. Google requires >=3 to render the star result anyway,
// and a single 1-star review pulls the rating to 1.0 across the entire
// product - so emitting earlier is the worst of both worlds.
const MIN_APPROVED_FOR_AGGREGATE_SCHEMA = 3
import { JsonLd } from "@/components/seo/json-ld"
import {
  aggregateRatingFragment,
  breadcrumbSchema,
  faqPageSchema,
  productSchema,
  reviewFragment,
} from "@/lib/seo/schema"
import { deriveImageAlt } from "@/lib/seo/helpers"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  FadeIn,
  ScaleIn,
  StaggerContainer,
  StaggerItem,
} from "@/components/shared/motion"
import { AddToCartButton } from "@/components/features/add-to-cart-button"
import { RelatedProducts } from "@/components/features/related-products"
import { ProductGallery } from "@/components/features/product-gallery"
import { ProductSdsDocuments } from "@/components/features/product-sds-documents"
import { BundleIndicator } from "@/components/features/bundle-indicator"
import { FirstOrderProductBanner } from "@/components/features/first-order-product-banner"
import { StampProductBanner } from "@/components/features/stamp-product-banner"

interface ProductImageRow {
  id: string
  image_url: string
  is_cover: boolean
  sort_order: number
}

async function getProductImages(productId: string): Promise<ProductImageRow[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) return []

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/product_images?product_id=eq.${productId}&select=id,image_url,is_cover,sort_order&order=is_cover.desc,sort_order.asc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        next: { revalidate: 60 },
      },
    )
    if (res.ok) return res.json()
  } catch {
    // Silent fail
  }
  return []
}

async function getProduct(slug: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=*,packaging_prices:product_packaging_prices(*,packaging_size:packaging_sizes(*))&limit=1`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          // Short cache - long enough to amortise repeat hits within a
          // page render, short enough that admin visibility changes show
          // up to buyers within a minute. Was 60s; kept identical here
          // but the filter logic now runs every revalidation so any
          // is_available flip is honoured the moment the cache rolls.
          next: { revalidate: 30 },
        },
      )

      if (res.ok) {
        const rows = await res.json()
        const data = rows[0]
        if (data) {
          // Filter out hidden packaging variants:
          //   - product_packaging_prices.is_available = false → per-product
          //     opt-out (e.g. AdBlue Phase 1 hides Jerry Can / Drum / IBC for
          //     AdBlue only, leaves them on every other product)
          //   - packaging_sizes.is_visible_on_storefront = false → globally
          //     retired container type
          // Mirrors the same filter we apply in /api/products[*].
          const rawPrices = (data.packaging_prices ?? []) as Array<{
            id: string
            packaging_size_id: string
            price_per_litre: number | null
            fixed_price: number | null
            minimum_order_quantity: number | null
            is_available?: boolean | null
            packaging_size: {
              id: string
              name: string
              volume_litres: number | null
              container_type?: string | null
              is_visible_on_storefront?: boolean | null
            }
          }>
          const visiblePrices = rawPrices.filter(
            (pp) =>
              pp.is_available !== false &&
              pp.packaging_size?.is_visible_on_storefront !== false,
          )

          // Derive packagingSizes from the visible price rows so the
          // "Pack sizes" facet, FAQ schema, and AddToCart all stay in
          // sync with what's actually buyable. Falls back to the legacy
          // text array for products that haven't been migrated to
          // per-size pricing yet.
          const derivedPackagingSizes =
            visiblePrices.length > 0
              ? visiblePrices
                  .map((pp) => pp.packaging_size?.name)
                  .filter((n): n is string => !!n)
              : ((data.packaging_sizes as string[]) ?? [])

          return {
            id: data.id as string,
            name: data.name as string,
            slug: data.slug as string,
            price: data.price as number,
            unit: data.unit as string,
            description: data.description as string,
            manufacturer: data.manufacturer as string,
            category: data.category as string,
            classification: data.classification as string,
            casNumber: data.cas_number as string,
            packagingSizes: derivedPackagingSizes,
            safetyInfo: data.safety_info as string,
            deliveryInfo: data.delivery_info as string,
            shippingFee: (data.shipping_fee as number) ?? 0,
            inStock: data.in_stock as boolean,
            stockQty: data.stock_qty as number,
            region: data.region as string,
            image: (data.image_url as string) || "/images/cqvs-logo.png",
            badge: data.badge as string | null,
            priceType: (data.price_type as "per_litre" | "fixed") ?? "per_litre",
            packagingPrices: visiblePrices,
          }
        }
      }
    } catch {
      // Fall through to static data
    }
  }

  const staticProduct = getProductBySlug(slug)
  if (!staticProduct) return null
  return {
    ...staticProduct,
    shippingFee: 0,
    priceType: "per_litre" as const,
    packagingPrices: [] as Array<{
      id: string
      packaging_size_id: string
      price_per_litre: number | null
      fixed_price: number | null
      minimum_order_quantity: number | null
      packaging_size: {
        id: string
        name: string
        volume_litres: number | null
        container_type?: string | null
      }
    }>,
  }
}

async function getRelatedProducts(category: string, excludeSlug: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/products?category=eq.${encodeURIComponent(category)}&slug=neq.${encodeURIComponent(excludeSlug)}&is_active=eq.true&select=id,name,slug,price,unit,manufacturer,category,image_url,badge&limit=8`,
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
            image: (p.image_url as string) || "/images/cqvs-logo.png",
            badge: (p.badge as string) || null,
          }))
        }
      }
    } catch {
      // Fall through to static
    }
  }

  // Static fallback
  return staticProducts
    .filter((p) => p.category === category && p.slug !== excludeSlug)
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      unit: p.unit,
      manufacturer: p.manufacturer,
      category: p.category,
      image: p.image || "/images/cqvs-logo.png",
      badge: p.badge ?? null,
    }))
}

export function generateStaticParams() {
  return staticProducts.map((product) => ({
    slug: product.slug,
  }))
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    return {
      title: "Product Not Found",
      robots: { index: false, follow: false },
    }
  }

  const title = `${product.name} | Buy Bulk in Australia`
  const description =
    product.description?.slice(0, 158) ||
    `${product.name} - manufacturer-direct bulk supply across Australia. Live AUD pricing, GST-inclusive, DG-rated freight.`
  const url = `${SITE_URL}/products/${product.slug}`
  const image = product.image || `${SITE_URL}/images/cqvs-logo.png`
  const absoluteImage = image.startsWith("http") ? image : `${SITE_URL}${image}`

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
            qualifier: "Australia",
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

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    notFound()
  }

  const [relatedProducts, productImages] = await Promise.all([
    getRelatedProducts(product.category, product.slug),
    getProductImages(product.id),
  ])

  // Build the Product schema, then splice in aggregateRating + review[]
  // when the product clears the >=3-approved-reviews gate AND the global
  // kill switch is on (NEXT_PUBLIC_REVIEWS_VISIBLE !== "false"). One
  // 1-star review pulls the rating to 1.0 across the product, and Google
  // generally won't render the star result below 3 reviews - emitting the
  // schema below the threshold is the worst of both worlds.
  const productLd: Record<string, unknown> = productSchema({
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
    image: product.image || "/images/cqvs-logo.png",
    baseUrl: SITE_URL,
  })

  // Phase 2 split (per docs/Public-Review-Share-Link-Phase-2-Spec.html):
  //
  //   - aggregate  = verified-only count + average. Drives the headline
  //                  chip near the buy button + the AggregateRating JSON-LD
  //                  (gated at >=3 verified reviews so Google's rich-result
  //                  threshold is met and no single 1-star review can tank
  //                  the displayed average).
  //   - jsonLdReviews = verified-only Review[] - feeds Google's rich-result
  //                  Review array. Public-link reviews never go in here.
  //   - displayReviews = ALL approved reviews (verified + public mixed) for
  //                  the visible card list. Each card uses verified_buyer
  //                  to pick the right badge.
  let aggregate: Awaited<ReturnType<typeof getApprovedReviewAggregate>> = null
  let jsonLdReviews: Awaited<ReturnType<typeof getApprovedReviewsForProduct>> = []
  let displayReviews: Awaited<ReturnType<typeof getReviewsForDisplay>> = []

  if (REVIEWS_KILL_SWITCH_ON) {
    aggregate = await getApprovedReviewAggregate(product.id)
    // Always load the visible cards independently of verified count - this
    // is what enables the "0 verified, N public" branch from spec sec 9.2.
    displayReviews = await getReviewsForDisplay(product.id, 50)

    if (aggregate && aggregate.count >= MIN_APPROVED_FOR_AGGREGATE_SCHEMA) {
      jsonLdReviews = await getApprovedReviewsForProduct(product.id, 10)
      productLd.aggregateRating = aggregateRatingFragment({
        ratingValue: aggregate.averageRating,
        reviewCount: aggregate.count,
      })
      productLd.review = jsonLdReviews.map((r) =>
        reviewFragment({
          authorName: r.display_name,
          ratingValue: r.rating,
          reviewBody: r.body,
          datePublished: r.published_at,
          reviewHeadline: r.headline,
        }),
      )
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Schema.org structured data - Product + BreadcrumbList. Powers
          rich-result eligibility (price, stock, breadcrumb trail).
          AggregateRating + Review fragments are spliced in only when
          NEXT_PUBLIC_REVIEWS_VISIBLE is "true" - production default is OFF
          to avoid emitting fake-review schema (Google manual-action risk). */}
      <JsonLd id="ld-product" schema={productLd} />
      <JsonLd
        id="ld-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Products", url: `${SITE_URL}/products` },
          { name: product.name, url: `${SITE_URL}/products/${product.slug}` },
        ])}
      />
      {/* FAQPage schema - generic per-product Q&A composed from product
          fields. Light enough to render universally; heavier custom FAQ
          per product can be added by storing a `faqs` JSON column on the
          products table later. */}
      <JsonLd
        id="ld-product-faq"
        schema={faqPageSchema([
          {
            question: `Is ${product.name} in stock for delivery in Australia?`,
            answer: product.inStock
              ? `Yes - ${product.name} is currently in stock and ships from the closest Chem Connect warehouse to your delivery address. Most orders dispatch within 1 business day.`
              : `${product.name} is currently out of stock. Use the Custom Orders form to request restocking lead time, or browse alternatives in the same category.`,
          },
          {
            question: `What pack sizes does ${product.name} come in?`,
            answer:
              product.packagingSizes && product.packagingSizes.length > 0
                ? `${product.name} is available in ${product.packagingSizes.join(", ")}. Custom pack sizes can be sourced via the Custom Orders form.`
                : `Standard pack sizes for ${product.name} are listed on the product page. Custom sizes available via Custom Orders.`,
          },
          {
            question: `Is ${product.name} classified as dangerous goods (DG)?`,
            answer:
              product.classification === "Non-DG"
                ? `${product.name} is non-DG and ships through standard freight without the additional ADG-rated handling required for dangerous goods.`
                : `${product.name} is classified as ${product.classification}. It ships through approved Australian DG-rated freight carriers compliant with the ADG Code.`,
          },
          {
            question: `Are prices GST-inclusive?`,
            answer:
              "Prices are listed in AUD on the marketplace. GST is shown as a separate line in the cart. Invoices are tax-compliant for ABN-holding Australian businesses.",
          },
        ])}
      />

      {/* Breadcrumb */}
      <FadeIn delay={0}>
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link
            href="/products"
            className="transition-colors hover:text-foreground"
          >
            Products
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">{product.name}</span>
        </nav>

        <Link
          href="/products"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to Products
        </Link>
      </FadeIn>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          <ScaleIn>
            <ProductGallery
              images={productImages}
              fallbackImage={product.image}
              productName={product.name}
              altText={deriveImageAlt({
                name: product.name,
                category: product.category,
                manufacturer: product.manufacturer,
              })}
            />
          </ScaleIn>

          <FadeIn delay={0.15}>
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.25}>
            <Card className="border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-5" />
                  Safety Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-amber-800 dark:text-amber-300">
                  {product.safetyInfo}
                </p>
              </CardContent>
            </Card>
          </FadeIn>

          {/* SDS Documents */}
          <FadeIn delay={0.3}>
            <ProductSdsDocuments productId={product.id} />
          </FadeIn>
        </div>

        {/* Right column */}
        <StaggerContainer className="space-y-6" staggerDelay={0.08}>
          <StaggerItem>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {product.badge && (
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      product.badge === "Best Seller"
                        ? "bg-emerald-500 text-emerald-950"
                        : product.badge === "Coming Soon"
                          ? "bg-amber-400 text-amber-950"
                          : product.badge.startsWith("DG")
                            ? "bg-rose-500 text-rose-950"
                            : "bg-sky-500 text-sky-950"
                    }`}
                  >
                    {product.badge}
                  </span>
                )}
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    product.classification === "Non-DG"
                      ? "bg-sky-500/15 text-sky-400"
                      : "bg-rose-500/15 text-rose-400"
                  }`}
                >
                  {product.classification}
                </span>
              </div>

              <h1 className="mt-3 text-3xl font-bold tracking-tight">
                {product.name}
              </h1>

              {/* Sticky stars + count summary near the buy area. Renders
                  nothing until at least one approved review exists. Per
                  section 2.8 of the implementation plan. */}
              {REVIEWS_KILL_SWITCH_ON && aggregate && aggregate.count > 0 && (
                <div className="mt-2">
                  <ProductReviewsSummary aggregate={aggregate} />
                </div>
              )}

              {product.packagingPrices && product.packagingPrices.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Pricing by Packaging Size
                  </p>
                  <div className="space-y-1.5">
                    {product.packagingPrices.map((pp) => {
                      const litres = Number(pp.packaging_size?.volume_litres ?? 0)
                      const ct = (
                        pp.packaging_size?.container_type ?? ""
                      ).toLowerCase()
                      // A bulk / tanker variant is priced per litre but
                      // there's no fixed "per pack" total to show - the
                      // line total scales with whatever litres the buyer
                      // orders. Show the per-litre rate and a hint
                      // instead of a misleading $1.15 (which would be
                      // 1L * $1.15/L).
                      const isBulkVariant =
                        ct === "tanker" ||
                        ct === "bulk" ||
                        litres === 1
                      const total =
                        product.priceType === "per_litre"
                          ? Number(pp.price_per_litre ?? 0) * litres
                          : Number(pp.fixed_price ?? 0)
                      return (
                        <div
                          key={pp.id}
                          className="flex items-baseline justify-between rounded-md border border-border/50 bg-muted/30 px-3 py-2"
                        >
                          <span className="text-sm font-medium">
                            {pp.packaging_size?.name}
                          </span>
                          <div className="flex items-baseline gap-2">
                            {product.priceType === "per_litre" && (
                              <span className="text-xs text-muted-foreground">
                                AUD {Number(pp.price_per_litre ?? 0).toFixed(2)}/L
                              </span>
                            )}
                            {isBulkVariant ? (
                              <span className="text-xs italic text-muted-foreground">
                                tanker pump-in
                              </span>
                            ) : (
                              <span className="text-lg font-bold text-primary">
                                AUD {total.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-4xl font-bold text-primary">
                  AUD {product.price.toFixed(2)}
                  <span className="text-lg font-normal text-muted-foreground">
                    {" "}/ {product.unit}
                  </span>
                </p>
              )}
            </div>
          </StaggerItem>

          {/* First Order Banner - only on truck wash pages for new customers */}
          <StaggerItem>
            <FirstOrderProductBanner
              productSlug={product.slug}
              productPrice={product.price}
              productUnit={product.unit}
            />
          </StaggerItem>

          {/* Stamp indicator - shows on products with 1000L IBC packaging */}
          <StaggerItem>
            <StampProductBanner packagingSizes={product.packagingSizes} />
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  type SpecRow = {
                    label: string
                    value: string
                    mono?: boolean
                    href?: string
                  }
                  const rows: SpecRow[] = [
                    { label: "Manufacturer", value: product.manufacturer },
                  ]
                  if (
                    product.manufacturer &&
                    product.manufacturer !== product.category
                  ) {
                    const brandSlug = product.manufacturer
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-+|-+$/g, "")
                    rows.push({
                      label: "Brand page",
                      value: product.manufacturer,
                      href: `/brand/${brandSlug}`,
                    })
                  }
                  if (product.casNumber && product.casNumber !== "N/A") {
                    rows.push({
                      label: "CAS Number",
                      value: product.casNumber,
                      mono: true,
                    })
                  }
                  rows.push({
                    label: "Classification",
                    value: product.classification,
                  })
                  rows.push({ label: "Category", value: product.category })
                  if (
                    product.packagingSizes &&
                    product.packagingSizes.length > 0
                  ) {
                    rows.push({
                      label: "Pack sizes",
                      value: `${product.packagingSizes.length} option${product.packagingSizes.length === 1 ? "" : "s"}`,
                    })
                  }
                  if (product.region) {
                    rows.push({
                      label: "Dispatched from",
                      value: product.region,
                    })
                  }
                  return rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex justify-between gap-3"
                    >
                      <span className="text-muted-foreground">
                        {row.label}
                      </span>
                      {row.href ? (
                        <Link
                          href={row.href}
                          className={`font-medium text-primary hover:underline ${row.mono ? "font-mono" : ""}`}
                        >
                          {row.value}
                        </Link>
                      ) : (
                        <span
                          className={`font-medium ${row.mono ? "font-mono" : ""}`}
                        >
                          {row.value}
                        </span>
                      )}
                    </div>
                  ))
                })()}
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardContent className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Stock Status</span>
                </div>
                {product.inStock ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    In Stock - {product.stockQty} units
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
                    Out of Stock
                  </Badge>
                )}
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-4" />
                  Order Options
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AddToCartButton
                  productId={product.id}
                  productName={product.name}
                  packagingSizes={product.packagingSizes}
                  packagingPrices={product.packagingPrices}
                  priceType={product.priceType}
                  inStock={product.inStock}
                  stockQty={product.stockQty}
                />
              </CardContent>
            </Card>
          </StaggerItem>

          {/* Bundle indicator */}
          <StaggerItem>
            <BundleIndicator productId={product.id} />
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardContent className="flex items-start gap-3 pt-4">
                <Truck className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Delivery Information</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.deliveryInfo}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Shipping calculated at checkout based on your delivery postcode.
                  </p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

        </StaggerContainer>
      </div>

      {/* Customer reviews - data fetched server-side above; the component
          handles render-only logic (cards, marquee, empty state). When
          aggregate is null OR count is 0, the empty state shows
          "No reviews yet - be the first". The kill switch is enforced
          here so a runtime flip skips the section without code change.
          The id="reviews" target is what the buy-area summary chip
          anchors to. */}
      {REVIEWS_KILL_SWITCH_ON && (
        <div id="reviews" className="scroll-mt-20">
          <ProductReviews
            aggregate={aggregate}
            reviews={displayReviews}
            productName={product.name}
          />
        </div>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-12 border-t border-border/50 pt-8">
          <RelatedProducts products={relatedProducts} />
        </div>
      )}
    </div>
  )
}
