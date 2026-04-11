"use client"

import { useState, useMemo } from "react"
import { Package, SearchX } from "lucide-react"
import { domAnimation, LazyMotion, m, AnimatePresence } from "framer-motion"

import { useProducts } from "@/lib/hooks/use-products"
import { products as staticProducts, categories, regions } from "@/lib/data/products"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RecommendedProducts } from "@/components/features/recommended-products"
import { CatalogueHero } from "@/components/products/catalogue-hero"
import { FilterToolbar, type SortOption } from "@/components/products/filter-toolbar"
import { ProductCard } from "@/components/products/product-card"

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

  const hasActiveFilters =
    selectedCategory !== "All" ||
    selectedRegion !== "All" ||
    inStockOnly ||
    searchQuery !== ""

  function clearAllFilters() {
    setSearchQuery("")
    setSelectedCategory("All")
    setSelectedRegion("All")
    setInStockOnly(false)
    setSortBy("name-asc")
  }

  return (
    <LazyMotion features={domAnimation} strict>
      {/* ① Catalogue Hero */}
      <CatalogueHero
        productCount={filteredProducts.length}
        totalCount={products.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* ② Recommended For You (logged-in users only) */}
      <div className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <RecommendedProducts />
        </div>
      </div>

      {/* ③ Sticky Filter Toolbar */}
      <FilterToolbar
        categories={categories}
        regions={regions}
        selectedCategory={selectedCategory}
        selectedRegion={selectedRegion}
        sortBy={sortBy}
        inStockOnly={inStockOnly}
        onCategoryChange={setSelectedCategory}
        onRegionChange={setSelectedRegion}
        onSortChange={setSortBy}
        onStockToggle={() => setInStockOnly(!inStockOnly)}
      />

      {/* ④ Product Grid */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden rounded-2xl border-border/60">
                <Skeleton className="aspect-[5/4] rounded-b-none" />
                <CardContent className="space-y-3 pt-5">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
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
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {filteredProducts.map((product, index) => (
                <m.div
                  key={product.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: Math.min(index * 0.04, 0.24),
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  className="h-full"
                >
                  <ProductCard
                    id={product.id}
                    name={product.name}
                    slug={product.slug}
                    price={product.price}
                    unit={product.unit}
                    manufacturer={product.manufacturer}
                    classification={product.classification}
                    inStock={product.inStock}
                    packagingSizes={product.packagingSizes}
                    badge={product.badge}
                    image={product.image}
                  />
                </m.div>
              ))}
            </m.div>
          </AnimatePresence>
        )}

        {/* ⑤ Empty State */}
        {!isLoading && filteredProducts.length === 0 && (
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center py-24 text-center"
          >
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-card">
              <SearchX className="size-7 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              No products match your filters
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Try adjusting your search query or clearing some of the active
              filters to broaden your results.
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-6 rounded-full"
                onClick={clearAllFilters}
              >
                Clear all filters
              </Button>
            )}
          </m.div>
        )}
      </section>
    </LazyMotion>
  )
}
