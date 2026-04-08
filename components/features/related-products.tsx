"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"
import { domAnimation, LazyMotion, m } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface RelatedProduct {
  id: string
  name: string
  slug: string
  price: number
  unit: string
  manufacturer: string
  category: string
  image: string
  badge?: string | null
}

interface RelatedProductsProps {
  products: RelatedProduct[]
}

const badgeColors: Record<string, string> = {
  "Best Seller": "bg-emerald-500 text-emerald-950",
  "Coming Soon": "bg-amber-400 text-amber-950",
}

function getBadgeColor(badge: string): string {
  if (badge.startsWith("DG")) return "bg-rose-500 text-rose-950"
  return badgeColors[badge] || "bg-sky-500 text-sky-950"
}

export function RelatedProducts({ products }: RelatedProductsProps) {
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

  if (products.length === 0) return null

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return
    const cardWidth = scrollRef.current.querySelector("[data-card]")?.clientWidth || 288
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
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-6 lg:px-8"
      >
        {/* Header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              You might also like
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Similar products from our catalog
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full border-white/10 bg-card/80 backdrop-blur-sm transition-all",
                canScrollLeft
                  ? "opacity-100 hover:bg-primary/10 hover:border-primary/30"
                  : "opacity-30 cursor-default",
              )}
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-full border-white/10 bg-card/80 backdrop-blur-sm transition-all",
                canScrollRight
                  ? "opacity-100 hover:bg-primary/10 hover:border-primary/30"
                  : "opacity-30 cursor-default",
              )}
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Left fade */}
          <div
            className={cn(
              "pointer-events-none absolute left-0 top-0 z-10 h-full w-16 bg-linear-to-r from-background to-transparent transition-opacity duration-300",
              canScrollLeft ? "opacity-100" : "opacity-0",
            )}
          />

          {/* Right fade */}
          <div
            className={cn(
              "pointer-events-none absolute right-0 top-0 z-10 h-full w-16 bg-linear-to-l from-background to-transparent transition-opacity duration-300",
              canScrollRight ? "opacity-100" : "opacity-0",
            )}
          />

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {products.map((product, index) => (
              <m.div
                key={product.id}
                data-card
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                className="w-64 shrink-0 sm:w-72"
              >
                <Link href={`/products/${product.slug}`} className="group block">
                  <Card className="h-full overflow-hidden border-white/5 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:ring-1 hover:ring-primary/20">
                    {/* Image */}
                    <div className="relative h-44 overflow-hidden bg-white">
                      <Image
                        src={product.image || "/images/cqvs-logo.png"}
                        alt={product.name}
                        fill
                        sizes="288px"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      {product.badge && (
                        <span
                          className={`absolute right-2.5 top-2.5 rounded-md px-2 py-0.5 text-[10px] font-semibold shadow-lg backdrop-blur-sm ${getBadgeColor(product.badge)}`}
                        >
                          {product.badge}
                        </span>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>

                    <CardContent className="p-4">
                      <h3 className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
                        {product.name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {product.manufacturer} - {product.category}
                      </p>

                      <div className="mt-3 flex items-end justify-between border-t border-border/30 pt-3">
                        <div>
                          <span className="text-lg font-bold text-primary">
                            AUD {product.price.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            /{product.unit}
                          </span>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5">
                          View
                          <ArrowRight className="h-3 w-3" />
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
