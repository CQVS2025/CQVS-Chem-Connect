import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  MapPin,
  Package,
  Truck,
} from "lucide-react"

import { getProductBySlug, products as staticProducts } from "@/lib/data/products"
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
        `${supabaseUrl}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
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
        const data = rows[0]
        if (data) {
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
            packagingSizes: data.packaging_sizes as string[],
            safetyInfo: data.safety_info as string,
            deliveryInfo: data.delivery_info as string,
            shippingFee: (data.shipping_fee as number) ?? 0,
            inStock: data.in_stock as boolean,
            stockQty: data.stock_qty as number,
            region: data.region as string,
            image: (data.image_url as string) || "/images/cqvs-logo.png",
            badge: data.badge as string | null,
          }
        }
      }
    } catch {
      // Fall through to static data
    }
  }

  const staticProduct = getProductBySlug(slug)
  if (!staticProduct) return null
  return { ...staticProduct, shippingFee: 0 }
}

async function getRelatedProducts(category: string, excludeSlug: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/products?category=eq.${encodeURIComponent(category)}&slug=neq.${encodeURIComponent(excludeSlug)}&select=id,name,slug,price,unit,manufacturer,category,image_url,badge&limit=8`,
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)

  if (!product) {
    return { title: "Product Not Found - Chem Connect" }
  }

  return {
    title: `${product.name} - Chem Connect`,
    description: product.description,
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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

              <p className="mt-4 text-4xl font-bold text-primary">
                ${product.price.toFixed(2)}
                <span className="text-lg font-normal text-muted-foreground">
                  {" "}/ {product.unit}
                </span>
              </p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Manufacturer", value: product.manufacturer },
                  {
                    label: "CAS Number",
                    value: product.casNumber,
                    mono: true,
                  },
                  { label: "Classification", value: product.classification },
                  { label: "Category", value: product.category },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span
                      className={`font-medium ${row.mono ? "font-mono" : ""}`}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
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
                  <p className="mt-2 text-sm font-medium">
                    Shipping:{" "}
                    {product.shippingFee > 0 ? (
                      <span className="text-foreground">${product.shippingFee.toFixed(2)}</span>
                    ) : (
                      <span className="text-emerald-500">Free</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

          <StaggerItem>
            <Card>
              <CardContent className="flex items-start gap-3 pt-4">
                <MapPin className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Regional Availability</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Available in {product.region}
                  </p>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>

        </StaggerContainer>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-12 border-t border-border/50 pt-8">
          <RelatedProducts products={relatedProducts} />
        </div>
      )}
    </div>
  )
}
