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
      "First order delivered freight-free. We absorb $200-$500 in freight so you can trial risk-free.",
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    borderColor: "hover:ring-sky-400/30",
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
    borderColor: "hover:ring-violet-400/30",
  },
]

export function FirstOrderHook() {
  return (
    <section id="first-order" className="scroll-mt-36 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="mb-10">
            <span className="mb-3 block text-sm font-bold tracking-widest text-primary">
              02
            </span>
            <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
              First Order Hook
            </h2>
            <p className="max-w-2xl text-muted-foreground">
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
                    "group h-full border-white/5 bg-card/50 backdrop-blur-sm transition-all duration-300",
                    "hover:shadow-xl hover:shadow-primary/5 hover:ring-1",
                    option.borderColor
                  )}
                >
                  <CardContent className="flex h-full flex-col p-5 sm:p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div
                        className={cn(
                          "flex size-12 items-center justify-center rounded-2xl",
                          option.bgColor
                        )}
                      >
                        <Icon className={cn("size-6", option.color)} />
                      </div>
                      <span className="rounded-lg bg-muted/50 px-2.5 py-1 text-xs font-bold text-muted-foreground">
                        {option.label}
                      </span>
                    </div>

                    <h3 className="mb-1 text-xl font-bold">{option.title}</h3>
                    <p className="mb-3 text-xs font-medium text-muted-foreground">
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
          <div className="flex items-center gap-3 rounded-xl border border-primary/10 bg-primary/5 px-5 py-4">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
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
