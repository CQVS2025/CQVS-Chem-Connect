"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Search, Filter, Package } from "lucide-react"

import { useProducts } from "@/lib/hooks/use-products"
import { products as staticProducts, categories, regions } from "@/lib/data/products"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SortOption = "price-asc" | "price-desc" | "name-asc" | "name-desc"

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedRegion, setSelectedRegion] = useState("All")
  const [sortBy, setSortBy] = useState<SortOption>("name-asc")
  const [inStockOnly, setInStockOnly] = useState(false)

  // Fetch from Supabase, fall back to static data
  const { data: apiProducts, isLoading } = useProducts()

  // Normalize - API returns snake_case, static uses camelCase
  const products = useMemo(() => {
    if (apiProducts) {
      return apiProducts.map((p) => ({
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
        packagingSizes: p.packaging_sizes,
        safetyInfo: p.safety_info,
        deliveryInfo: p.delivery_info,
        inStock: p.in_stock,
        stockQty: p.stock_qty,
        region: p.region,
        image: p.image_url || "/images/cqvs-logo.png",
        badge: p.badge,
      }))
    }
    return staticProducts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      unit: p.unit,
      description: p.description,
      manufacturer: p.manufacturer,
      category: p.category,
      classification: p.classification,
      casNumber: p.casNumber,
      packagingSizes: p.packagingSizes,
      safetyInfo: p.safetyInfo,
      deliveryInfo: p.deliveryInfo,
      inStock: p.inStock,
      stockQty: p.stockQty,
      region: p.region,
      image: p.image || "/images/cqvs-logo.png",
      badge: p.badge ?? null,
    }))
  }, [apiProducts])

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesSearch =
        searchQuery === "" ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory =
        selectedCategory === "All" || product.category === selectedCategory
      const matchesRegion =
        selectedRegion === "All" || product.region === selectedRegion
      const matchesStock = !inStockOnly || product.inStock
      return matchesSearch && matchesCategory && matchesRegion && matchesStock
    })

    result.sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return a.price - b.price
        case "price-desc":
          return b.price - a.price
        case "name-asc":
          return a.name.localeCompare(b.name)
        case "name-desc":
          return b.name.localeCompare(a.name)
        default:
          return 0
      }
    })

    return result
  }, [products, searchQuery, selectedCategory, selectedRegion, sortBy, inStockOnly])

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Chemical Products
        </h1>
        <p className="mt-2 text-muted-foreground">
          Browse our extensive catalog of industrial chemicals
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products by name..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region === "All" ? "All Regions" : region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="price-asc">Price: Low to High</SelectItem>
              <SelectItem value="price-desc">Price: High to Low</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={inStockOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setInStockOnly(!inStockOnly)}
          >
            <Package className="size-3.5" />
            In Stock Only
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Showing {filteredProducts.length} of {products.length} products
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <Skeleton className="h-48 rounded-b-none" />
              <CardContent className="space-y-3 pt-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="flex flex-col">
              <div className="relative flex h-48 items-center justify-center rounded-t-xl bg-muted/30">
                <Image
                  src={product.image || "/images/cqvs-logo.png"}
                  alt={product.name}
                  width={120}
                  height={120}
                  className="object-contain"
                />
                {product.badge && (
                  <Badge
                    variant={
                      product.badge.startsWith("DG")
                        ? "destructive"
                        : product.badge === "Best Seller"
                          ? "default"
                          : "secondary"
                    }
                    className="absolute top-3 right-3"
                  >
                    {product.badge}
                  </Badge>
                )}
              </div>

              <CardContent className="flex flex-1 flex-col gap-3 pt-4">
                <div>
                  <h3 className="font-semibold leading-tight">{product.name}</h3>
                  <p className="mt-1 text-lg font-bold text-primary">
                    ${product.price.toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}/ {product.unit}
                    </span>
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  {product.manufacturer}
                </p>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      product.classification === "Non-DG" ? "secondary" : "destructive"
                    }
                  >
                    {product.classification}
                  </Badge>
                  {product.inStock ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      In Stock
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">
                      Out of Stock
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {product.packagingSizes.map((size) => (
                    <Badge key={size} variant="outline" className="text-[10px]">
                      {size}
                    </Badge>
                  ))}
                </div>
              </CardContent>

              <CardFooter>
                <Link href={`/products/${product.slug}`} className="w-full">
                  <Button variant="outline" className="w-full">
                    View Details
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredProducts.length === 0 && (
        <div className="py-16 text-center">
          <Package className="mx-auto size-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No products found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search or filter criteria.
          </p>
        </div>
      )}
    </div>
  )
}
