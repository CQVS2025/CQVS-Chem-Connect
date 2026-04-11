"use client"

import { Truck, FlaskConical, ShieldCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"
import { cn } from "@/lib/utils"

const options = [
  {
    id: "a",
    label: "Option A",
    title: "Free Freight",
    subtitle: "Best for: Remote sites",
    icon: Truck,
    description:
      "First order delivered freight-free. We absorb AUD 200-500 in freight so you can trial risk-free.",
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    borderAccent: "hover:border-sky-400/30",
    chipColor: "border-sky-400/20 bg-sky-400/10 text-sky-400",
  },
  {
    id: "b",
    label: "Option B",
    title: "Half-Price Truck Wash",
    subtitle: "Best for: Switching suppliers",
    icon: FlaskConical,
    description:
      "Container cost + chemical at 50% off on Truck Wash Standard or Truck Wash Premium. Available as a bonus with any first order.",
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
    borderAccent: "hover:border-violet-400/30",
    chipColor: "border-violet-400/20 bg-violet-400/10 text-violet-400",
  },
]

export function FirstOrderHook() {
  return (
    <section id="first-order" className="scroll-mt-36 border-t border-border/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-12">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              02 - First Order
            </div>
            <h2 className="mb-3 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl">
              First Order Hook
            </h2>
            <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
              Your first order is risk-free. Two ways to try us - choose what
              works for you.
            </p>
          </div>
        </FadeIn>

        <StaggerContainer className="mb-8 grid gap-4 sm:grid-cols-2">
          {options.map((option) => {
            const Icon = option.icon
            return (
              <StaggerItem key={option.id}>
                <Card
                  className={cn(
                    "group h-full rounded-3xl border border-border/60 bg-card transition-all duration-300",
                    "hover:shadow-xl hover:shadow-primary/5",
                    option.borderAccent
                  )}
                >
                  <CardContent className="flex h-full flex-col p-6 sm:p-7">
                    <div className="mb-5 flex items-start justify-between">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20",
                          option.bgColor
                        )}
                      >
                        <Icon className={cn("size-5", option.color)} />
                      </div>
                      <span className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
                        option.chipColor
                      )}>
                        {option.label}
                      </span>
                    </div>

                    <h3 className="mb-1 text-xl font-bold tracking-[-0.01em] text-foreground">{option.title}</h3>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {option.subtitle}
                    </p>

                    <p className="mt-auto text-sm leading-relaxed text-muted-foreground">
                      {option.description}
                    </p>
                  </CardContent>
                </Card>
              </StaggerItem>
            )
          })}
        </StaggerContainer>

        <FadeIn delay={0.2}>
          <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-5 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Try us risk-free. If we don&apos;t save you money, you&apos;ve
              lost nothing.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
