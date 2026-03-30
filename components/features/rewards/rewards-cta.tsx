"use client"

import Link from "next/link"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FadeIn } from "@/components/shared/motion"

export function RewardsCTA() {
  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <div className="relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:px-12">
            {/* Background */}
            <div className="absolute inset-0 bg-linear-to-br from-primary/10 via-primary/5 to-card/80 backdrop-blur-sm" />
            <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

            <div className="relative">
              <h2 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
                Ready to Start Saving?
              </h2>
              <p className="mx-auto mb-8 max-w-lg text-muted-foreground">
                No contracts. No lock-in. No minimum commitment. Just better
                chemicals at better prices with rewards that stack.
              </p>

              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="shadow-md shadow-primary/25 transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/40"
                  asChild
                >
                  <Link href="/products">
                    Place Your First Order
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/#how-it-works">
                    <MessageCircle className="mr-2 size-4" />
                    Talk to Our Team
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
