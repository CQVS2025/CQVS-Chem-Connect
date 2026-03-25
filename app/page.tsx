import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  Bell,
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
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { products } from "@/lib/data/products"
import { MarketplaceNavbar } from "@/components/layouts/marketplace-navbar"
import { MarketplaceFooter } from "@/components/layouts/marketplace-footer"

export const metadata = {
  title: "Chem Connect - Bulk Chemicals at Unbeatable Prices | CQVS",
  description:
    "Chem Connect is the B2B chemical marketplace by CQVS. Manufacturing-direct pricing for concrete plants and quarries. One-click ordering, live inventory, and local delivery.",
}

const featuredProducts = products.slice(0, 6)

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

const benefits = [
  {
    icon: ShoppingCart,
    title: "One-Click Ordering",
    description:
      "Save time with instant re-orders, saved templates, and a streamlined checkout built for bulk buyers.",
  },
  {
    icon: MapPin,
    title: "Local Manufacturers",
    description:
      "Every product ships from your state. Shorter lead times, lower freight costs, and local support.",
  },
  {
    icon: Lock,
    title: "Locked Pricing",
    description:
      "Lock in your quoted price for 30 days. No surprise surcharges or hidden fees at checkout.",
  },
  {
    icon: Warehouse,
    title: "Live Inventory",
    description:
      "See real-time stock levels before you order. No more back-and-forth emails to confirm availability.",
  },
  {
    icon: Headphones,
    title: "Direct Support",
    description:
      "Talk to real chemical specialists - not a call center. Fast answers on SDS, compliance, and custom orders.",
  },
]

export default function HomePage() {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketplaceNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="absolute inset-0 bg-linear-to-b from-primary/5 via-primary/2 to-transparent" />
        <div className="absolute -top-24 left-1/2 h-125 w-200 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            B2B Marketplace by CQVS
          </div>

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

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Bulk Chemicals.{" "}
            <span className="text-primary">Unbeatable Prices.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            A manufacturing-direct marketplace for concrete plants and quarries.
            Skip the middleman and order straight from the source.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="shadow-primary/25 shadow-lg hover:shadow-primary/40 hover:shadow-xl transition-shadow duration-200" asChild>
              <Link href="/products">
                Browse Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/register">Create Free Account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="border-t border-border bg-card/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Featured Products
            </h2>
            <p className="mt-3 text-muted-foreground">
              Manufacturing-direct chemicals at wholesale pricing
            </p>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="group block min-w-70 shrink-0 sm:min-w-0"
              >
                <Card className="h-full transition-all duration-200 hover:shadow-lg hover:ring-primary/20 hover:ring-2">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="inline-flex rounded-xl bg-primary/10 p-2.5">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      {product.badge && (
                        <Badge
                          variant={
                            product.badge === "Best Seller"
                              ? "default"
                              : product.badge === "Coming Soon"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {product.badge}
                        </Badge>
                      )}
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.manufacturer} - {product.category}
                      </p>
                    </div>

                    <div className="flex items-end justify-between border-t border-border pt-3">
                      <div>
                        <span className="text-xl font-bold text-primary">
                          ${product.price.toFixed(2)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /{product.unit}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        View Product
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Button variant="outline" size="lg" asChild>
              <Link href="/products">
                View All Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground">
              From sign-up to delivery in four simple steps
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.title} className="relative text-center">
                {index < steps.length - 1 && (
                  <div className="absolute right-0 top-8 hidden h-px w-full translate-x-1/2 bg-border lg:block" />
                )}
                <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
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
            ))}
          </div>
        </div>
      </section>

      {/* Why Chem Connect */}
      <section className="border-t border-border bg-card/50 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Why Chem Connect
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built for the way concrete and quarry businesses actually buy chemicals
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            {benefits.map((benefit) => (
              <Card
                key={benefit.title}
                className="w-full transition-shadow duration-200 hover:shadow-lg sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
              >
                <CardContent className="space-y-3 p-6">
                  <div className="inline-flex rounded-xl bg-primary/10 p-3">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold">{benefit.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Request Product CTA */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-12">
            <CheckCircle className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Don&apos;t See What You Need?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tell us what chemical you are looking for and we will source it
              from our manufacturer network.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Input
                type="text"
                placeholder="e.g. Calcium Chloride, Degreaser, Dust Suppressant..."
                className="h-10 flex-1 sm:h-11"
              />
              <Button size="lg" className="shadow-primary/25 shadow-md">
                Submit Request
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border px-4 py-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl bg-primary/5 px-6 py-16 text-center sm:px-12">
          <div className="absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-primary/5" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              Ready to Save on Your Chemical Costs?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join concrete plants and quarries across Australia already saving
              with manufacturing-direct pricing on Chem Connect.
            </p>
            <Button
              size="lg"
              className="mt-8 shadow-primary/25 shadow-lg hover:shadow-primary/40 hover:shadow-xl transition-shadow duration-200"
              asChild
            >
              <Link href="/sign-up">
                Create Your Free Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketplaceFooter />
    </div>
  )
}
