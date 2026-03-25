"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Package } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HorizontalScroll } from "@/components/shared/horizontal-scroll"
import { FadeIn } from "@/components/shared/motion"

interface Product {
  id: string
  name: string
  slug: string
  price: number
  unit: string
  manufacturer: string
  category: string
  badge?: string | null
  image?: string | null
}

interface FeaturedProductsScrollProps {
  products: Product[]
}

export function FeaturedProductsScroll({
  products,
}: FeaturedProductsScrollProps) {
  return (
    <section className="border-t border-border/50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Featured Products
            </h2>
            <p className="mt-3 text-muted-foreground">
              Manufacturing-direct chemicals at wholesale pricing
            </p>
          </div>
        </FadeIn>
      </div>

      <HorizontalScroll className="px-4 sm:px-6 lg:px-8">
        {/* Leading spacer for a bit of left padding */}
        <div className="shrink-0 w-[max(1rem,calc((100vw-80rem)/2))]" />

        {products.map((product, index) => (
          <div
            key={product.id}
            className="shrink-0 w-[85vw] sm:w-[45vw] lg:w-[30vw] xl:w-[25vw]"
          >
            <Link
              href={`/products/${product.slug}`}
              className="group block h-full"
            >
              <Card className="h-full border-white/5 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:ring-1 hover:ring-primary/20 overflow-hidden">
                {/* Image */}
                <div className="relative h-56 bg-white overflow-hidden">
                  <Image
                    src={product.image || "/images/cqvs-logo.png"}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 30vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
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
                  {/* Subtle index */}
                  <span className="absolute bottom-3 left-3 text-xs font-mono text-muted-foreground/40">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {product.manufacturer} - {product.category}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-end justify-between border-t border-border/50 pt-3">
                    <div>
                      <span className="text-2xl font-bold text-primary">
                        ${product.price.toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        /{product.unit}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5">
                      View
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        ))}

        {/* CTA card at the end */}
        <div className="shrink-0 w-[85vw] sm:w-[45vw] lg:w-[30vw] xl:w-[25vw]">
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-8 text-center">
            <div>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Package className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">View All Products</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse our complete catalog of industrial chemicals
              </p>
              <Button className="mt-6 rounded-xl" asChild>
                <Link href="/products">
                  See All Products
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Trailing spacer */}
        <div className="shrink-0 w-[max(1rem,calc((100vw-80rem)/2))]" />
      </HorizontalScroll>
    </section>
  )
}
