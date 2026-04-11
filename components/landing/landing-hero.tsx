"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import {
  ArrowRight,
  TrendingDown,
  ShieldCheck,
  Zap,
  Truck,
  CheckCircle2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { AuthCTA } from "@/components/shared/auth-cta"
import { FadeIn, BlurIn } from "@/components/shared/motion"

export interface HeroProduct {
  id: string
  name: string
  price: number
  unit: string
  image: string | null
  state: string
  inStock: number
}

interface LandingHeroProps {
  tickerProducts: HeroProduct[]
}

const trustChips = [
  { icon: ShieldCheck, label: "SDS Compliant" },
  { icon: Zap, label: "Same-day Quotes" },
  { icon: Truck, label: "DG-Rated Freight" },
]

export function LandingHero({ tickerProducts }: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden px-4 pt-28 pb-20 sm:px-6 sm:pt-36 sm:pb-28 lg:px-8 lg:pt-40 lg:pb-32">
      {/* Soft radial halo behind right-side card */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/4 h-[600px] w-[600px] -translate-y-1/2 translate-x-1/3 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-emerald-500/8 blur-3xl"
      />

      {/* Subtle dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* LEFT: copy + CTAs */}
          <div className="lg:col-span-7">
            <FadeIn delay={0.05} direction="none">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary backdrop-blur-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Australian B2B Marketplace
              </div>
            </FadeIn>

            <BlurIn delay={0.15}>
              <h1 className="mt-6 text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
                <span className="block bg-linear-to-br from-primary via-emerald-400 to-primary bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                  Bulk Chemicals.
                </span>
                <span className="mt-2 block bg-linear-to-br from-emerald-400 via-primary to-emerald-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                  Unbeatable Prices.
                </span>
              </h1>
            </BlurIn>

            <FadeIn delay={0.3} distance={12}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                A manufacturing-direct marketplace for concrete plants and
                quarries. Skip the middleman and order straight from the source.
              </p>
            </FadeIn>

            <FadeIn delay={0.42} distance={12}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="h-12 rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-px hover:shadow-xl hover:shadow-primary/35"
                  asChild
                >
                  <Link href="/products">
                    Browse Products
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <AuthCTA variant="outline" />
              </div>
            </FadeIn>

            <FadeIn delay={0.55} distance={10}>
              <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2">
                {trustChips.map((chip) => (
                  <div
                    key={chip.label}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <chip.icon className="h-3.5 w-3.5 text-primary/70" />
                    <span>{chip.label}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>

          {/* RIGHT: live price ticker */}
          <div className="lg:col-span-5">
            <FadeIn delay={0.4} direction="right">
              <PriceTickerCard products={tickerProducts} />
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  )
}

// ============================================================
// Live Price Ticker Card
// ============================================================

function PriceTickerCard({ products }: { products: HeroProduct[] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const items = products.length > 0 ? products : fallbackProducts

  useEffect(() => {
    if (items.length <= 1) return
    const id = setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length)
    }, 4000)
    return () => clearInterval(id)
  }, [items.length])

  return (
    <div className="relative">
      {/* Glow halo */}
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/20 via-emerald-500/10 to-transparent blur-2xl"
      />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-border/80 bg-card/95 p-5 shadow-2xl shadow-primary/10 backdrop-blur-xl sm:p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Live pricing
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Updated just now</span>
        </div>

        {/* Items list */}
        <div className="space-y-3">
          {items.slice(0, 3).map((product, idx) => (
            <div
              key={product.id}
              className={`relative flex items-center gap-4 rounded-2xl border p-3 transition-all duration-500 ${
                idx === activeIndex
                  ? "border-primary/40 bg-primary/5 shadow-md shadow-primary/10"
                  : "border-border/40 bg-background/40"
              }`}
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white">
                <Image
                  src={product.image || "/images/cqvs-logo.png"}
                  alt={product.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {product.name}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  <span>
                    {product.inStock} in stock · {product.state}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-primary">
                  AUD {product.price.toFixed(2)}
                </p>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  /{product.unit}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between rounded-xl border border-border/40 bg-background/30 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5 text-primary" />
            <span>Save up to 25% vs traditional suppliers</span>
          </div>
          <Link
            href="/products"
            className="text-xs font-semibold text-primary hover:underline"
          >
            See all →
          </Link>
        </div>
      </div>
    </div>
  )
}

const fallbackProducts: HeroProduct[] = [
  {
    id: "1",
    name: "Eco Wash",
    price: 1.8,
    unit: "L",
    image: null,
    state: "NSW",
    inStock: 24,
  },
  {
    id: "2",
    name: "Truck Wash Premium",
    price: 1.95,
    unit: "L",
    image: null,
    state: "VIC",
    inStock: 18,
  },
  {
    id: "3",
    name: "Green Acid Replacement",
    price: 2.45,
    unit: "L",
    image: null,
    state: "QLD",
    inStock: 12,
  },
]
