import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Home, Mail, MapPin, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { categories as categoryList } from "@/lib/data/products"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  title: "Page not found",
  description:
    "The page you're looking for has moved or doesn't exist. Browse the Chem Connect catalogue, our seven Australian dispatch hubs, or get in touch with support.",
  alternates: { canonical: `${SITE_URL}/404` },
  // Don't index 404 pages - they're not content, they're errors. The
  // helpful navigation below lives here purely as a UX cushion so the
  // visitor has somewhere obvious to go next.
  robots: { index: false, follow: false },
}

function categoryToSlug(label: string) {
  return label.toLowerCase().replace(/\s+/g, "-")
}

/**
 * 404 page - never a dead end. Gives the visitor:
 *   - a search box (linked back to /products with their query)
 *   - the top product categories
 *   - quick links to locations + support
 *
 * Renders the same chrome as the rest of the marketplace because Next
 * uses the closest layout above it (here: the root layout, since this
 * sits at the project root rather than inside a route group). That's
 * deliberate - header / footer still wrap, so the visitor never feels
 * stranded.
 */
export default function NotFoundPage() {
  const visibleCategories = categoryList.filter((c) => c !== "All")

  return (
    <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          404 &middot; Not found
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          That page isn&rsquo;t here.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          The page you were looking for may have moved, or the link might be
          out of date. Pick up from one of these -
        </p>
      </div>

      {/* Search */}
      <form action="/products" method="get" className="mt-10">
        <label
          htmlFor="not-found-search"
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Search the catalogue
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="not-found-search"
            type="search"
            name="search"
            placeholder="e.g. acetone, sodium hydroxide, AdBlue, IBC"
            className="w-full rounded-md border border-border/60 bg-card px-10 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </form>

      {/* Top categories */}
      <section className="mt-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Or browse by category
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleCategories.map((c) => (
            <Link
              key={c}
              href={`/categories/${categoryToSlug(c)}`}
              className="group flex items-center justify-between rounded-md border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-card/80"
            >
              <span className="text-sm font-medium group-hover:text-primary">
                {c}
              </span>
              <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <Link
              href="/"
              className="group flex items-center gap-3 text-sm font-semibold"
            >
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Home className="size-4" />
              </span>
              Home
              <ArrowRight className="ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <Link
              href="/locations"
              className="group flex items-center gap-3 text-sm font-semibold"
            >
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </span>
              Locations
              <ArrowRight className="ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <Link
              href="/support"
              className="group flex items-center gap-3 text-sm font-semibold"
            >
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Mail className="size-4" />
              </span>
              Support
              <ArrowRight className="ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>
      </section>

      <div className="mt-10 text-center">
        <Button variant="outline" asChild>
          <Link href="/products">
            Browse the full catalogue <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>
    </main>
  )
}
