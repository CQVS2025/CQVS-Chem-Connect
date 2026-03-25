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
  ShoppingCart,
  FileText,
  Truck,
} from "lucide-react"

import { getProductBySlug, products as staticProducts } from "@/lib/data/products"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PageTransition } from "@/components/shared/page-transition"

// Try to fetch from Supabase via direct REST, fall back to static data
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

  return getProductBySlug(slug) || null
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

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
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

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Image
                  src={product.image}
                  alt={product.name}
                  width={280}
                  height={280}
                  className="object-contain"
                  priority
                />
              </CardContent>
            </Card>

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
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {product.badge && (
                  <Badge
                    variant={
                      product.badge.startsWith("DG")
                        ? "destructive"
                        : product.badge === "Best Seller"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {product.badge}
                  </Badge>
                )}
                <Badge
                  variant={
                    product.classification === "Non-DG"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {product.classification}
                </Badge>
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

            <Card>
              <CardHeader>
                <CardTitle>Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Manufacturer</span>
                  <span className="font-medium">{product.manufacturer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CAS Number</span>
                  <span className="font-mono font-medium">
                    {product.casNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Classification</span>
                  <span className="font-medium">{product.classification}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{product.category}</span>
                </div>
              </CardContent>
            </Card>

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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-4" />
                  Packaging Options
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {product.packagingSizes.map((size, index) => (
                    <button
                      key={size}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        index === 0
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50 hover:bg-muted"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-start gap-3 pt-4">
                <Truck className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Delivery Information</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.deliveryInfo}
                  </p>
                </div>
              </CardContent>
            </Card>

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

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="flex-1 gap-2 glow-primary">
                <ShoppingCart className="size-4" />
                Add to Cart
              </Button>
              <Button variant="outline" size="lg" className="flex-1 gap-2">
                <FileText className="size-4" />
                Request Quote
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
