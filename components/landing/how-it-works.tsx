import { Search, MousePointerClick, Truck } from "lucide-react"

import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"

const steps = [
  {
    icon: Search,
    title: "Browse & Quote",
    description:
      "Search the live catalogue. See your locked 30-day price instantly — no quote forms, no waiting.",
    micro: "Live pricing",
  },
  {
    icon: MousePointerClick,
    title: "Order in 60 seconds",
    description:
      "One-click checkout. Pay by card or upload a PO. Saved templates make repeat orders effortless.",
    micro: "60s avg checkout",
  },
  {
    icon: Truck,
    title: "Delivered in 2-5 days",
    description:
      "DG-rated freight from a manufacturer in your state. Tracked end-to-end, with live ETA updates.",
    micro: "From your state",
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-t border-border/60 px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="mb-16 flex flex-col items-center text-center">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              How It Works
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
              From quote to delivery in 3 steps.
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              No phone tag. No hidden surcharges. The whole flow takes less time
              than your morning coffee.
            </p>
          </div>
        </FadeIn>

        <StaggerContainer
          className="relative grid gap-8 md:grid-cols-3 md:gap-6 lg:gap-10"
          staggerDelay={0.12}
        >
          {/* Connector line — desktop only */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[16.66%] right-[16.66%] top-9 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />

          {steps.map((step, index) => (
            <StaggerItem key={step.title}>
              <div className="relative flex flex-col items-center text-center">
                {/* Numbered icon */}
                <div className="relative mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-primary/20 bg-card shadow-lg shadow-primary/5">
                  <step.icon className="h-7 w-7 text-primary" />
                  <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg shadow-primary/30">
                    {index + 1}
                  </span>
                </div>

                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>

                <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                  {step.micro}
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  )
}
