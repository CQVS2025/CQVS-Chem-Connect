"use client"

import {
  Gift,
  Users,
  RotateCcw,
  Tags,
  Calendar,
  Sparkles,
  Package,
  Stamp,
} from "lucide-react"

import { FadeIn } from "@/components/shared/motion"

const perks = [
  {
    id: "first-order",
    icon: Gift,
    title: "First Order Bonus",
    description:
      "Choose free freight or 50% off a truck wash product on your very first order.",
    highlight: "New customers only",
    span: "sm:col-span-1",
  },
  {
    id: "referrals",
    icon: Users,
    title: "Refer & Earn",
    description:
      "Refer a concrete plant or quarry. When they place their first order, both of you get rewarded.",
    highlight: "AUD 100 credit each",
    span: "sm:col-span-1",
  },
  {
    id: "bundles",
    icon: Tags,
    title: "Bundle Deals",
    description:
      "Buy 2+ qualifying products together and save 10-15% automatically at checkout.",
    highlight: "Auto-applied",
    span: "sm:col-span-1",
  },
  {
    id: "rebates",
    icon: RotateCcw,
    title: "Annual Rebates",
    description:
      "Hit your annual spend target and earn up to 10% back as a credit note for next year.",
    highlight: "Up to 10% back",
    span: "sm:col-span-1",
  },
  {
    id: "seasonal",
    icon: Calendar,
    title: "Seasonal Promotions",
    description:
      "Exclusive limited-time deals on high-demand chemicals. Discounts, free freight, or bonus products.",
    highlight: "Limited time",
    span: "sm:col-span-1",
  },
  {
    id: "new-products",
    icon: Sparkles,
    title: "New Product Launch",
    description:
      "Be first to try new formulations with exclusive early-access pricing — up to 20% off launch week.",
    highlight: "Early access",
    span: "sm:col-span-1",
  },
  {
    id: "stamp-card",
    icon: Stamp,
    title: "Digital Stamp Card",
    description:
      "Every order earns a stamp. Collect 10 and choose a free product from the stamp reward catalogue.",
    highlight: "10 stamps = free product",
    span: "sm:col-span-2 lg:col-span-1",
  },
  {
    id: "stacking",
    icon: Package,
    title: "Stack All Rewards",
    description:
      "Every program works independently. Volume tier + bundle deal + seasonal promo = maximum savings on a single order.",
    highlight: "Combine everything",
    span: "sm:col-span-2 lg:col-span-1",
  },
]

export function PerksBento() {
  return (
    <section className="border-t border-border/60 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="mb-14 flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              8 Ways to Save
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
              Real perks, not gimmicks.
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Every program stacks. No points to track, no apps to download —
              savings land directly on your invoice.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((perk, i) => (
            <FadeIn key={perk.id} delay={i * 0.06} className={perk.span}>
              <div className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 sm:p-7">
                {/* Hover glow */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/5 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                />

                <div className="relative flex h-full flex-col">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                    <perk.icon className="size-5 text-primary" />
                  </div>

                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {perk.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {perk.description}
                  </p>

                  <div className="mt-5 inline-flex items-center gap-1.5 self-start rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    {perk.highlight}
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}
