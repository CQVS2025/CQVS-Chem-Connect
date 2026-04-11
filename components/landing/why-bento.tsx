import {
  ShoppingCart,
  MapPin,
  TrendingDown,
  Headphones,
  CheckCircle2,
} from "lucide-react"

import { FadeIn } from "@/components/shared/motion"

export function WhyBento() {
  return (
    <section className="border-t border-border/60 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="mb-14 flex flex-col items-center text-center">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Why Chem Connect
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
              Built for the way you actually buy.
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Product decisions that turn chemical procurement from a week-long
              phone game into a 60-second checkout.
            </p>
          </div>
        </FadeIn>

        {/* Bento grid */}
        <div className="grid auto-rows-[minmax(200px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {/* 1. ONE-CLICK ORDERING */}
          <FadeIn className="lg:col-span-2">
            <BentoCard className="h-full">
              <BentoIcon icon={ShoppingCart} />
              <div className="mt-auto">
                <BentoTitle>One-click ordering</BentoTitle>
                <BentoBody>
                  Re-order regulars instantly with saved templates.
                </BentoBody>
                <BentoStat>10x faster vs phone</BentoStat>
              </div>
            </BentoCard>
          </FadeIn>

          {/* 2. LOCAL WAREHOUSES */}
          <FadeIn delay={0.08} className="lg:col-span-2">
            <BentoCard className="h-full">
              <BentoIcon icon={MapPin} />
              <div className="mt-auto">
                <BentoTitle>Local warehouses</BentoTitle>
                <BentoBody>
                  Dispatched from a manufacturer in your state.
                </BentoBody>
                <BentoStat>2-5 day delivery</BentoStat>
              </div>
            </BentoCard>
          </FadeIn>

          {/* 3. MANUFACTURER-DIRECT PRICING */}
          <FadeIn delay={0.16} className="lg:col-span-2">
            <BentoCard className="h-full">
              <BentoIcon icon={TrendingDown} />
              <div className="mt-auto">
                <BentoTitle>Manufacturer-direct pricing</BentoTitle>
                <BentoBody>
                  Buy straight from the source and cut out the middleman
                  markup.
                </BentoBody>
                <BentoStat>Up to 25% savings</BentoStat>
              </div>
            </BentoCard>
          </FadeIn>

          {/* 4. DIRECT SUPPORT - full width */}
          <FadeIn delay={0.24} className="lg:col-span-6">
            <BentoCard className="h-full">
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                    <Headphones className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <BentoTitle>Direct line to chemical specialists</BentoTitle>
                    <BentoBody>
                      Talk to real chemists, not a call centre. Fast answers on
                      SDS, compliance, custom formulations and bulk pricing.
                    </BentoBody>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {["SDS support", "DG compliance", "Custom orders"].map(
                    (chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground"
                      >
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                        {chip}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </BentoCard>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}

// ============================================================
// Reusable bento sub-components
// ============================================================

function BentoCard({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-border/60 bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 sm:p-8 ${className}`}
    >
      {/* Subtle glow on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/5 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative flex h-full flex-col">{children}</div>
    </div>
  )
}

function BentoIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
      <Icon className="h-5 w-5 text-primary" />
    </div>
  )
}

function BentoTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
      {children}
    </h3>
  )
}

function BentoBody({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
      {children}
    </p>
  )
}

function BentoStat({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
      {children}
    </div>
  )
}
