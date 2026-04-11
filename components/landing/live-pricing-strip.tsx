import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/motion"

interface LivePricingProduct {
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

interface LivePricingStripProps {
  products: LivePricingProduct[]
}

export function LivePricingStrip({ products }: LivePricingStripProps) {
  return (
    <section className="border-t border-border/60 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <FadeIn>
          <div className="mb-14 flex flex-col items-center text-center">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Live Pricing - No Login
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.02em] text-foreground sm:text-4xl lg:text-5xl">
              Real prices, today.
            </h2>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              No quote forms. No phone calls. Browse manufacturer-direct pricing
              the same way you check Stripe rates.
            </p>
          </div>
        </FadeIn>

        <StaggerContainer
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          staggerDelay={0.07}
        >
          {products.map((product) => (
            <StaggerItem key={product.id}>
              <Link
                href={`/products/${product.slug}`}
                className="group block h-full"
              >
                <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                  {/* Image */}
                  <div className="relative aspect-[5/4] overflow-hidden bg-white">
                    <Image
                      src={product.image || "/images/cqvs-logo.png"}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />

                    {/* Badge */}
                    {product.badge && (
                      <span
                        className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider shadow-md ${
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

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.manufacturer} · {product.category}
                    </p>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-3xl font-black tracking-tight text-primary sm:text-4xl">
                        AUD {product.price.toFixed(2)}
                      </span>
                      <span className="text-sm font-semibold text-primary/80">
                        /{product.unit}
                      </span>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        <span>In stock</span>
                      </div>
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100">
                        View details
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <FadeIn delay={0.2}>
          <div className="mt-14 text-center">
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-xl px-7 text-[15px] font-semibold"
              asChild
            >
              <Link href="/products">
                See full catalogue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
