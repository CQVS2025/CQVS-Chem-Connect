"use client"

import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { FadeIn } from "@/components/shared/motion"

interface CatalogueHeroProps {
  productCount: number
  totalCount: number
  searchQuery: string
  onSearchChange: (value: string) => void
}

export function CatalogueHero({
  productCount,
  totalCount,
  searchQuery,
  onSearchChange,
}: CatalogueHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-border/60 px-4 pt-12 pb-10 sm:px-6 sm:pt-16 sm:pb-14 lg:px-8">
      {/* Decorative background */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[800px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl">
        <FadeIn>
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
            {/* Left: title */}
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Catalogue
              </span>
              <h1 className="mt-5 text-4xl font-black tracking-[-0.025em] text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
                Industrial chemicals,
                <br />
                <span className="text-primary">manufacturer-direct.</span>
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                Browse {totalCount}+ chemicals across {productCount === totalCount ? "all" : "filtered"} categories.
                Live pricing, in-stock badges, no quote forms.
              </p>
            </div>

            {/* Right: search */}
            <div className="w-full lg:max-w-md">
              <div className="group relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
                />
                <Input
                  placeholder="Search chemicals, brands, CAS numbers…"
                  className="h-12 rounded-2xl border-border/60 bg-card pl-11 pr-10 text-base shadow-sm transition-all duration-200 focus-visible:border-primary/50 focus-visible:shadow-md focus-visible:shadow-primary/5"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange("")}
                    className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">
                  <span className="font-semibold text-foreground">{productCount}</span>{" "}
                  of {totalCount} shown
                </span>
                <span className="hidden sm:inline">Press ⌘K to focus</span>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
