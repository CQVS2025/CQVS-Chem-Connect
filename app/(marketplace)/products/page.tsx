import type { Metadata } from "next"

import { ProductsClient } from "./products-client"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  title: "Industrial Chemicals - Buy Bulk Online Australia",
  description:
    "Browse 30+ bulk industrial chemicals - acids, alkalis, truck washes, agi gels, solvents. Live AUD pricing, no quote forms. 2-5 day DG-rated freight from VIC, NSW, QLD, SA, WA.",
  alternates: { canonical: `${SITE_URL}/products` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/products`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "Industrial Chemicals - Buy Bulk Online Australia · Chem Connect",
    description:
      "Browse 30+ bulk industrial chemicals - acids, alkalis, truck washes, agi gels, solvents. Live AUD pricing, no quote forms. 2-5 day DG-rated freight.",
    images: [
      {
        url: `${SITE_URL}/images/cqvs-logo.png`,
        width: 1200,
        height: 630,
        alt: "Chem Connect - Industrial Chemicals Australia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Industrial Chemicals - Buy Bulk Online Australia · Chem Connect",
    description:
      "Browse 30+ bulk industrial chemicals. Live AUD pricing, GST-inclusive, DG-rated freight from 5 Australian states.",
    images: [`${SITE_URL}/images/cqvs-logo.png`],
  },
}

/**
 * Shape of an active product row pulled from Supabase. Mirrors the columns
 * the products list cares about so we don't fetch unused data.
 */
interface ProductRow {
  id: string
  name: string
  slug: string
  price: number
  unit: string
  description: string
  manufacturer: string
  category: string
  classification: string
  cas_number: string
  packaging_sizes: string[]
  safety_info: string
  delivery_info: string
  in_stock: boolean
  stock_qty: number
  region: string
  image_url: string | null
  badge: string | null
  // Joined for accurate per-product visibility - the legacy
  // packaging_sizes text array can drift from the actual available
  // variants once admin starts toggling is_available.
  product_packaging_prices?: Array<{
    is_available: boolean | null
    packaging_size: {
      name: string
      sort_order: number | null
      is_visible_on_storefront: boolean | null
    } | null
  }>
}

/**
 * Server-side fetch of every active product. Runs at request time on the
 * server so Googlebot and AI crawlers see a populated catalog in the HTML
 * response - no JS execution required. 5-minute revalidation keeps the
 * data fresh without slamming Supabase on every request.
 */
async function getActiveProducts() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return []

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/products?is_active=eq.true&select=id,name,slug,price,unit,description,manufacturer,category,classification,cas_number,packaging_sizes,safety_info,delivery_info,in_stock,stock_qty,region,image_url,badge,product_packaging_prices(is_available,packaging_size:packaging_sizes(name,sort_order,is_visible_on_storefront))&order=name.asc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        // Short revalidation so admin visibility flips show up on the
        // catalogue within 30s instead of the previous 5-minute lag.
        next: { revalidate: 30 },
      },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as ProductRow[]

    // Normalise Supabase snake_case + null image into the shape ProductsClient expects.
    return rows.map((p) => {
      // Derive the chip list from product_packaging_prices, filtered to
      // what's actually buyable today. Falls back to the legacy
      // packaging_sizes text array for products that haven't been
      // migrated to per-size pricing yet.
      const visiblePrices = (p.product_packaging_prices ?? []).filter(
        (pp) =>
          pp.is_available !== false &&
          pp.packaging_size?.is_visible_on_storefront !== false &&
          pp.packaging_size?.name,
      )
      const tilePackagingSizes =
        visiblePrices.length > 0
          ? visiblePrices
              .slice()
              .sort(
                (a, b) =>
                  (a.packaging_size?.sort_order ?? 0) -
                  (b.packaging_size?.sort_order ?? 0),
              )
              .map((pp) => pp.packaging_size!.name)
          : (p.packaging_sizes ?? [])

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        unit: p.unit,
        description: p.description,
        manufacturer: p.manufacturer,
        category: p.category,
        classification: p.classification,
        casNumber: p.cas_number,
        packagingSizes: tilePackagingSizes,
        safetyInfo: p.safety_info,
        deliveryInfo: p.delivery_info,
        inStock: p.in_stock,
        stockQty: p.stock_qty,
        region: p.region,
        image: p.image_url || "/images/cqvs-logo.png",
        badge: p.badge,
      }
    })
  } catch {
    return []
  }
}

export default async function ProductsPage() {
  const initialProducts = await getActiveProducts()
  return <ProductsClient initialProducts={initialProducts} />
}
