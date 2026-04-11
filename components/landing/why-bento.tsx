import {
  Warehouse,
  ShoppingCart,
  MapPin,
  Lock,
  Headphones,
  TrendingDown,
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
              Five product decisions that turn chemical procurement from a
              week-long phone game into a 60-second checkout.
            </p>
          </div>
        </FadeIn>

        {/* Bento grid: 6 cols × 4 rows on desktop */}
        <div className="grid auto-rows-[minmax(200px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:grid-rows-[minmax(220px,auto)_minmax(220px,auto)]">
          {/* 1. LIVE INVENTORY — large hero card (col 1-4, row 1) */}
          <FadeIn className="lg:col-span-4">
            <BentoCard className="h-full">
              <BentoIcon icon={Warehouse} />
              <div className="mt-auto">
                <BentoTitle>Live inventory across Australia</BentoTitle>
                <BentoBody>
                  See real-time stock levels at every warehouse before you order.
                  No more email back-and-forth to confirm availability.
                </BentoBody>

                {/* Inline mini stat list */}
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    { label: "NSW", count: "324" },
                    { label: "VIC", count: "267" },
                    { label: "QLD", count: "411" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="rounded-xl border border-border/50 bg-background/40 px-3 py-2.5"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {row.label}
                      </p>
                      <p className="mt-0.5 text-lg font-bold text-foreground">
                        {row.count} <span className="text-xs font-medium text-muted-foreground">IBCs</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </BentoCard>
          </FadeIn>

          {/* 2. ONE-CLICK ORDERING — square (col 5-6, row 1) */}
          <FadeIn delay={0.08} className="lg:col-span-2">
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

          {/* 3. LOCAL WAREHOUSES — square (col 1-2, row 2) */}
          <FadeIn delay={0.16} className="lg:col-span-2">
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

          {/* 4. LOCKED PRICING — wide (col 3-6, row 2) */}
          <FadeIn delay={0.24} className="lg:col-span-4">
            <BentoCard className="h-full">
              <BentoIcon icon={Lock} />
              <div className="grid h-full gap-6 sm:grid-cols-5">
                <div className="sm:col-span-3">
                  <BentoTitle>Locked 30-day pricing</BentoTitle>
                  <BentoBody>
                    The price you see at quote is the price you pay at checkout —
                    for 30 days. No fuel surcharges. No rate-card surprises.
                  </BentoBody>
                </div>

                {/* Mini "stable line" visual */}
                <div className="relative sm:col-span-2">
                  <div className="absolute inset-0 flex items-end justify-around gap-2 pb-2">
                    {[60, 60, 60, 60, 60, 60, 60].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-md bg-primary/20"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                    <div className="absolute inset-x-0 bottom-[60%] h-px bg-primary/60" />
                  </div>
                  <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <TrendingDown className="h-2.5 w-2.5" />
                    No surprises
                  </div>
                </div>
              </div>
            </BentoCard>
          </FadeIn>

          {/* 5. DIRECT SUPPORT — full width row 3 (col 1-6) */}
          <FadeIn delay={0.32} className="lg:col-span-6">
            <BentoCard className="h-full">
              <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                    <Headphones className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <BentoTitle>Direct line to chemical specialists</BentoTitle>
                    <BentoBody>
                      Talk to real chemists — not a call centre. Fast answers on
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
