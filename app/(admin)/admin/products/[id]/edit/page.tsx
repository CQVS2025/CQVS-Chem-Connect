"use client"

import { use } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"

import { get } from "@/lib/api/client"
import { ProductForm, type ProductFormInitialData } from "@/components/admin/product-form"

interface ProductDetail {
  id: string
  name: string
  price: number
  unit: string
  category: string
  description: string
  manufacturer: string
  classification: string
  cas_number: string
  safety_info: string
  packaging_sizes: string[]
  delivery_info: string
  region: string
  stock_qty: number
  in_stock: boolean
  reviews_enabled?: boolean
  shipping_fee: number | null
  badge: string | null
  image_url: string | null
  price_type: "per_litre" | "fixed" | null
  packaging_prices?: Array<{
    packaging_size_id: string
    price_per_litre: number | null
    fixed_price: number | null
    minimum_order_quantity: number | null
  }>
}

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const { data, isLoading, error } = useQuery({
    queryKey: ["products", "detail", id],
    queryFn: () => get<ProductDetail>(`/products/${id}`),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading product...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load product. It may have been deleted.
      </div>
    )
  }

  const initial: ProductFormInitialData = {
    id: data.id,
    name: data.name,
    price: data.price,
    unit: data.unit,
    category: data.category,
    description: data.description,
    manufacturer: data.manufacturer,
    classification: data.classification,
    cas_number: data.cas_number,
    safety_info: data.safety_info,
    packaging_sizes: data.packaging_sizes ?? [],
    delivery_info: data.delivery_info,
    region: data.region,
    stock_qty: data.stock_qty,
    in_stock: data.in_stock,
    reviews_enabled: data.reviews_enabled ?? true,
    shipping_fee: data.shipping_fee ?? 0,
    badge: data.badge,
    image_url: data.image_url,
    price_type: data.price_type ?? "per_litre",
    packaging_prices: (data.packaging_prices ?? []).map((pp) => ({
      packaging_size_id: pp.packaging_size_id,
      price_per_litre: pp.price_per_litre,
      fixed_price: pp.fixed_price,
      minimum_order_quantity: pp.minimum_order_quantity ?? null,
    })),
  }

  return <ProductForm mode="edit" initial={initial} />
}
