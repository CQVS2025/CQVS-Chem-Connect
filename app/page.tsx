import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  CheckCircle,
  Headphones,
  Lock,
  MapPin,
  MousePointerClick,
  Package,
  ShoppingCart,
  Truck,
  UserPlus,
  Warehouse,
  Bell,
  FlaskConical,
  Shield,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { products } from "@/lib/data/products"
import { MarketplaceNavbar } from "@/components/layouts/marketplace-navbar"
import { MarketplaceFooter } from "@/components/layouts/marketplace-footer"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { AuthCTA, AuthCTAPrimary } from "@/components/shared/auth-cta"
import { ProductRequestForm } from "@/components/shared/product-request-form"
import {
  FadeIn,
  StaggerContainer,
  StaggerItem,
  ScaleIn,
  BlurIn,
  FloatingElement,
} from "@/components/shared/motion"

export const metadata = {
  title: "Chem Connect - Bulk Chemicals at Unbeatable Prices | CQVS",
  description:
    "Chem Connect is the B2B chemical marketplace by CQVS. Manufacturing-direct pricing for concrete plants and quarries.",
}

// Fetch products server-side from Supabase, fall back to static data
interface FeaturedProduct {
  id: string
  name: string
  slug: string
  price: number
  unit: string
  manufacturer: string
  category: string
  badge: string | null
  image: string | null
}

async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/products?select=id,name,slug,price,unit,manufacturer,category,badge,image_url&order=name.asc&limit=6`,
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
        if (rows.length > 0) {
          return rows.map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            slug: p.slug as string,
            price: p.price as number,
            unit: p.unit as string,
            manufacturer: p.manufacturer as string,
            category: p.category as string,
            badge: (p.badge as string) || null,
            image: (p.image_url as string) || null,
          }))
        }
      }
    } catch {
      // Fall through to static
    }
  }

  return products.slice(0, 6).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    unit: p.unit,
    manufacturer: p.manufacturer,
    category: p.category,
    badge: p.badge ?? null,
    image: p.image ?? null,
  }))
}

const steps = [
  {
    icon: UserPlus,
    title: "Register Your Business",
    description:
      "Create a free account in under 2 minutes. No credit card required to browse.",
  },
  {
    icon: Bell,
    title: "Live Alerts On Pricing",
    description:
      "Get notified when prices drop on the chemicals you use most.",
  },
  {
    icon: MousePointerClick,
    title: "One-Click Ordering",
    description:
      "Re-order your regular chemicals instantly with saved order templates.",
  },
  {
    icon: Truck,
    title: "Delivered to Your Site",
    description:
      "DG-rated and standard freight shipped direct from your state.",
  },
]

const stickyFeatures = [
  {
    icon: ShoppingCart,
    title: "One-Click Ordering",
    description:
      "No phone calls. No waiting. Save time with instant re-orders, saved templates, and a streamlined checkout built for bulk buyers.",
    stat: "10x faster than traditional method",
  },
  {
    icon: MapPin,
    title: "Local Manufacturers",
    description:
      "Every product ships from your state. Shorter lead times, lower freight costs, and local support when you need it.",
    stat: "2-5 day delivery, 98% on-time",
  },
  {
    icon: Lock,
    title: "Locked Pricing",
    description:
      "Lock in your quoted price for 30 days. No surprise surcharges or hidden fees at checkout. What you see is what you pay.",
    stat: "Guaranteed pricing for 30 days",
  },
  {
    icon: Warehouse,
    title: "Live Inventory",
    description:
      "See real-time stock levels before you order. No more back-and-forth emails to confirm availability.",
    stat: "1,000+ IBCs available across Australia",
  },
  {
    icon: Headphones,
    title: "Direct Support",
    description:
      "Talk to real chemical specialists - not a call center. Fast answers on SDS, compliance, and custom orders.",
    stat: "Direct manufacturer line",
  },
]

const trustPoints = [
  { icon: FlaskConical, label: "Verified Formulations" },
  { icon: Shield, label: "SDS Compliant" },
  { icon: Zap, label: "Fast Dispatch" },
  { icon: Truck, label: "DG-Rated Transport" },
]

export default async function HomePage() {
  const scrollProducts = await getFeaturedProducts()
  return (
    <div className="flex min-h-svh flex-col">
      <MarketplaceNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-32 pb-24 sm:px-6 sm:pt-40 sm:pb-32 lg:px-8">
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-primary/2 to-transparent" />
        <div className="absolute -top-40 left-1/2 h-125 w-200 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-20 right-0 h-75 w-75 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <FadeIn delay={0.1} direction="none">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              B2B Marketplace by CQVS
            </div>
          </FadeIn>

          <FadeIn delay={0.2} direction="none">
            <FloatingElement duration={4} distance={6}>
              <div className="mb-8 flex justify-center">
                <Image
                  src="/images/cqvs-logo.png"
                  alt="CQVS Logo"
                  width={120}
                  height={40}
                  className="object-contain"
                  priority
                />
              </div>
            </FloatingElement>
          </FadeIn>

          <BlurIn delay={0.3}>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Bulk Chemicals.{" "}
              <span className="bg-linear-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                Unbeatable Prices.
              </span>
            </h1>
          </BlurIn>

          <FadeIn delay={0.5} distance={16}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              A manufacturing-direct marketplace for concrete plants and quarries.
              Skip the middleman and order straight from the source.
            </p>
          </FadeIn>

          <FadeIn delay={0.65} distance={16}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button
                size="lg"
                className="rounded-xl shadow-primary/25 shadow-lg hover:shadow-primary/40 hover:shadow-xl transition-all duration-200"
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

          <FadeIn delay={0.8} distance={12}>
            <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              {trustPoints.map((point) => (
                <div key={point.label} className="flex items-center gap-2">
                  <point.icon className="h-4 w-4 text-primary/70" />
                  <span>{point.label}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Featured Products */}
      <section className="border-t border-border/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Featured Products
              </h2>
              <p className="mt-3 text-muted-foreground">
                Manufacturing-direct chemicals at wholesale pricing
              </p>
            </div>
          </FadeIn>

          <StaggerContainer
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            staggerDelay={0.08}
          >
            {scrollProducts.map((product) => (
              <StaggerItem key={product.id}>
                <Link
                  href={`/products/${product.slug}`}
                  className="group block"
                >
                  <Card className="flex h-full flex-col overflow-hidden border-white/5 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 hover:ring-1 hover:ring-primary/20">
                    <div className="relative h-48 overflow-hidden bg-white">
                      <Image
                        src={product.image || "/images/cqvs-logo.png"}
                        alt={product.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {product.badge && (
                        <span
                          className={`absolute right-3 top-3 rounded-md px-2.5 py-1 text-xs font-semibold shadow-lg backdrop-blur-sm ${
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

                    <CardContent className="flex flex-1 flex-col gap-2 p-5">
                      <h3 className="font-semibold transition-colors group-hover:text-primary">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {product.manufacturer} - {product.category}
                      </p>
                    </CardContent>

                    <CardFooter className="flex items-end justify-between border-t border-border/30 px-5 py-4">
                      <div>
                        <span className="text-xl font-bold text-primary">
                          ${product.price.toFixed(2)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /{product.unit}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5">
                        View Details
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>

          <FadeIn delay={0.3}>
            <div className="mt-12 text-center">
              <Button variant="outline" size="lg" className="rounded-xl" asChild>
                <Link href="/products">
                  View All Products
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="scroll-mt-24 border-t border-border/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <FadeIn>
            <div className="mb-14 text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                How It Works
              </h2>
              <p className="mt-3 text-muted-foreground">
                From sign-up to delivery in four simple steps
              </p>
            </div>
          </FadeIn>

          <StaggerContainer
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
            staggerDelay={0.12}
          >
            {steps.map((step, index) => (
              <StaggerItem key={step.title}>
                <div className="relative text-center">
                  {index < steps.length - 1 && (
                    <div className="absolute right-0 top-8 hidden h-px w-full translate-x-1/2 bg-border lg:block" />
                  )}
                  <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 backdrop-blur-sm">
                    <step.icon className="h-7 w-7 text-primary" />
                    <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mb-2 font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Sticky Scroll Section */}
      <section className="border-t border-border/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <div className="mb-14 text-center">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Why Chem Connect
              </h2>
              <p className="mt-3 text-muted-foreground">
                Built for the way concrete and quarry businesses actually buy chemicals
              </p>
            </div>
          </FadeIn>

          <div className="lg:flex lg:gap-12">
            {/* Left side - sticky */}
            <FadeIn direction="left" className="mb-10 lg:sticky lg:top-28 lg:mb-0 lg:w-5/12 lg:self-start">
              <div className="rounded-2xl border border-white/5 bg-card/50 p-8 backdrop-blur-sm">
                <div className="mb-6 inline-flex rounded-2xl bg-primary/10 p-4">
                  <Package className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold tracking-tight">
                  Everything you need to procure chemicals smarter
                </h3>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  Chem Connect replaces phone calls, emails, and price shopping
                  with a single platform. One login. Real-time pricing. Direct
                  from manufacturers in your state.
                </p>
                <div className="mt-8 flex flex-col gap-3 text-sm">
                  {[
                    "No minimum order quantities",
                    "Free account - no setup fees",
                    "DG and Non-DG products",
                  ].map((text) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 w-full">
                  <AuthCTA />
                </div>
              </div>
            </FadeIn>

            {/* Right side - scrolling cards */}
            <div className="flex flex-col gap-6 lg:w-7/12">
              {stickyFeatures.map((feature, index) => (
                <FadeIn key={feature.title} delay={index * 0.08} direction="right">
                  <div className="group rounded-2xl border border-white/5 bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 sm:p-8">
                    <div className="flex items-start gap-4 sm:gap-5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{feature.title}</h3>
                          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                            0{index + 1}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                          <Zap className="h-3 w-3" />
                          {feature.stat}
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Request Product CTA */}
      <section className="border-t border-border/50 px-4 py-20 sm:px-6 lg:px-8">
        <ScaleIn className="mx-auto max-w-2xl text-center">
          <div className="rounded-2xl border border-white/5 bg-card/50 p-8 backdrop-blur-sm sm:p-12">
            <CheckCircle className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Don&apos;t See What You Need?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tell us what chemical you are looking for and we will source it
              from our manufacturer network.
            </p>
            <ProductRequestForm />
          </div>
        </ScaleIn>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/50 px-4 py-20 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
            <div className="absolute inset-0 border border-white/5 rounded-3xl bg-linear-to-br from-primary/10 via-primary/5 to-card/80 backdrop-blur-sm" />
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

            <div className="relative z-10">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                Ready to Save on Your Chemical Costs?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Join concrete plants and quarries across Australia already saving
                with manufacturing-direct pricing on Chem Connect.
              </p>
              <AuthCTAPrimary />
            </div>
          </div>
        </FadeIn>
      </section>

      <MarketplaceFooter />
    </div>
  )
}
