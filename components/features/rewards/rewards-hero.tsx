"use client"

import { Gift, Percent, Truck, Package, DollarSign } from "lucide-react"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"

const stats = [
  {
    label: "Annual rebate",
    value: "10%",
    prefix: "Up to",
    icon: Percent,
  },
  {
    label: "At Silver+",
    value: "Free",
    prefix: "Monthly product",
    icon: Package,
  },
  {
    label: "For Gold members",
    value: "Free",
    prefix: "All freight",
    icon: Truck,
  },
  {
    label: "To join",
    value: "AUD 0",
    prefix: "Cost",
    icon: DollarSign,
  },
]

interface RewardsHeroProps {
  onScrollTo: (id: string) => void
}

export function RewardsHero({ onScrollTo }: RewardsHeroProps) {
  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-12">
      {/* Background decorations */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-125 w-200 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
      <div className="pointer-events-none absolute top-20 right-0 h-75 w-75 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative mx-auto max-w-5xl">
        <FadeIn className="flex flex-col items-center text-center">
          {/* Label */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm">
            <Gift className="size-4" />
            LOYALTY & REWARDS
          </div>

          {/* Heading */}
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="bg-linear-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              Buy More. Save More.
            </span>
            <br />
            <span className="text-foreground">Get Rewarded.</span>
          </h1>

          {/* Subtitle */}
          <p className="mb-12 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Every litre earns rewards. No contracts, no points, no apps - just
            real products back in your hands.
          </p>
        </FadeIn>

        {/* Stats grid */}
        <StaggerContainer className="mx-auto mb-12 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {stats.map((stat) => (
            <StaggerItem key={stat.label}>
              <div className="group rounded-2xl border border-white/5 bg-card/50 p-4 text-center backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 sm:p-5">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {stat.prefix}
                </p>
                <p className="mb-1 text-3xl font-bold text-primary sm:text-4xl">
                  {stat.value}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Explore link */}
        <FadeIn delay={0.3} className="text-center">
          <button
            onClick={() => onScrollTo("volume-tiers")}
            className="group inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            Explore 8 programs
            <svg
              className="size-4 transition-transform group-hover:translate-y-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
        </FadeIn>
      </div>
    </section>
  )
}
