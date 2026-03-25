"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { Search, Filter, Package, ArrowRight } from "lucide-react"
import { domAnimation, LazyMotion, m, AnimatePresence } from "framer-motion"

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
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"

type SortOption = "price-asc" | "price-desc" | "name-asc" | "name-desc"

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedRegion, setSelectedRegion] = useState("All")
  const [sortBy, setSortBy] = useState<SortOption>("name-asc")
  const [inStockOnly, setInStockOnly] = useState(false)

  const { data: apiProducts, isLoading } = useProducts()

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
    <LazyMotion features={domAnimation} strict>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <FadeIn>
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight">
              Chemical Products
            </h1>
            <p className="mt-2 text-muted-foreground">
              Browse our extensive catalog of industrial chemicals
            </p>
          </div>
        </FadeIn>

        {/* Search */}
        <FadeIn delay={0.1}>
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
        </FadeIn>

        {/* Category pills */}
        <FadeIn delay={0.15}>
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="transition-all duration-200"
              >
                {category}
              </Button>
            ))}
          </div>
        </FadeIn>

        {/* Filters row */}
        <FadeIn delay={0.2}>
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

            <m.p
              key={filteredProducts.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-muted-foreground"
            >
              Showing {filteredProducts.length} of {products.length} products
            </m.p>
          </div>
        </FadeIn>

        {/* Product grid */}
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
          <AnimatePresence mode="wait">
            <m.div
              key={`${selectedCategory}-${selectedRegion}-${sortBy}-${inStockOnly}-${searchQuery}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {filteredProducts.map((product, index) => (
                <m.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(index * 0.05, 0.3),
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  <m.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                    <Card className="flex flex-col overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:ring-1 hover:ring-primary/20">
                      <div className="relative h-48 overflow-hidden bg-muted/30">
                        <Image
                          src={product.image || "/images/cqvs-logo.png"}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 hover:scale-105"
                        />
                        {product.badge && (
                          <span
                            className={`absolute top-3 right-3 rounded-md px-2.5 py-1 text-xs font-semibold shadow-lg backdrop-blur-sm ${
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
                          <Button variant="outline" className="w-full group/btn">
                            View Details
                            <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  </m.div>
                </m.div>
              ))}
            </m.div>
          </AnimatePresence>
        )}

        {/* Empty state */}
        {!isLoading && filteredProducts.length === 0 && (
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="py-16 text-center"
          >
            <Package className="mx-auto size-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">No products found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filter criteria.
            </p>
          </m.div>
        )}
      </div>
    </LazyMotion>
  )
}
