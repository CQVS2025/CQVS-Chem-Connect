"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { domAnimation, LazyMotion, m } from "framer-motion"

import { cn } from "@/lib/utils"
import { useUser } from "@/lib/hooks/use-auth"
import { useOrders } from "@/lib/hooks/use-orders"
import { useProducts } from "@/lib/hooks/use-products"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const badgeColors: Record<string, string> = {
  "Best Seller": "bg-emerald-500 text-emerald-950",
  "Coming Soon": "bg-amber-400 text-amber-950",
}

function getBadgeColor(badge: string): string {
  if (badge.startsWith("DG")) return "bg-rose-500 text-rose-950"
  return badgeColors[badge] || "bg-sky-500 text-sky-950"
}

export function RecommendedProducts() {
  const { user } = useUser()
  const { data: orders } = useOrders()
  const { data: allProducts } = useProducts()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener("scroll", checkScroll, { passive: true })
    window.addEventListener("resize", checkScroll)
    return () => {
      el.removeEventListener("scroll", checkScroll)
      window.removeEventListener("resize", checkScroll)
    }
  }, [checkScroll])

  // Don't show if not logged in or no order history
  if (!user || !orders?.length || !allProducts?.length) return null

  // Get products the user has ordered
  const orderedProductIds = new Set<string>()
  const orderedCategories = new Set<string>()

  orders.forEach((order) => {
    order.items?.forEach((item) => {
      orderedProductIds.add(item.product_id)
    })
  })

  // Get categories of ordered products
  allProducts.forEach((p) => {
    if (orderedProductIds.has(p.id)) {
      orderedCategories.add(p.category)
    }
  })

  // Recommend products from same categories that haven't been ordered,
  // plus best sellers they haven't tried
  const recommended = allProducts
    .filter((p) => {
      if (orderedProductIds.has(p.id)) return false
      if (!p.in_stock) return false
      return (
        orderedCategories.has(p.category) ||
        p.badge === "Best Seller"
      )
    })
    .slice(0, 8)

  if (recommended.length === 0) return null

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return
    const cardWidth =
      scrollRef.current.querySelector("[data-card]")?.clientWidth || 288
    scrollRef.current.scrollBy({
      left: direction === "left" ? -(cardWidth + 16) : cardWidth + 16,
      behavior: "smooth",
    })
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <m.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        {/* Header */}
        <div className="mb-5 flex items-end justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Recommended For You
              </h2>
              <p className="text-xs text-muted-foreground">
                Based on your order history
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-xs"
              className={cn(
                "rounded-full border-white/10 bg-card/80 backdrop-blur-sm transition-all",
                canScrollLeft
                  ? "opacity-100 hover:bg-primary/10 hover:border-primary/30"
                  : "opacity-30 cursor-default"
              )}
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              className={cn(
                "rounded-full border-white/10 bg-card/80 backdrop-blur-sm transition-all",
                canScrollRight
                  ? "opacity-100 hover:bg-primary/10 hover:border-primary/30"
                  : "opacity-30 cursor-default"
              )}
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative">
          <div
            className={cn(
              "pointer-events-none absolute left-0 top-0 z-10 h-full w-12 bg-linear-to-r from-background to-transparent transition-opacity duration-300",
              canScrollLeft ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute right-0 top-0 z-10 h-full w-12 bg-linear-to-l from-background to-transparent transition-opacity duration-300",
              canScrollRight ? "opacity-100" : "opacity-0"
            )}
          />

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {recommended.map((product, index) => (
              <m.div
                key={product.id}
                data-card
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="w-56 shrink-0 sm:w-60"
              >
                <Link
                  href={`/products/${product.slug}`}
                  className="group block"
                >
                  <Card className="h-full overflow-hidden border-white/5 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 hover:ring-1 hover:ring-primary/20">
                    <div className="relative h-36 overflow-hidden bg-white">
                      <Image
                        src={product.image_url || "/images/cqvs-logo.png"}
                        alt={product.name}
                        fill
                        sizes="240px"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      {product.badge && (
                        <span
                          className={`absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold shadow-lg ${getBadgeColor(product.badge)}`}
                        >
                          {product.badge}
                        </span>
                      )}
                    </div>

                    <CardContent className="p-3">
                      <h3 className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
                        {product.name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {product.manufacturer}
                      </p>
                      <div className="mt-2 flex items-end justify-between">
                        <div>
                          <span className="text-base font-bold text-primary">
                            ${product.price.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            /{product.unit}
                          </span>
                        </div>
                        <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary opacity-0 transition-all group-hover:opacity-100">
                          View
                          <ArrowRight className="size-2.5" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </m.div>
            ))}
          </div>
        </div>
      </m.section>
    </LazyMotion>
  )
}
