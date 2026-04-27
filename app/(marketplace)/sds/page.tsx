import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Download, FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { JsonLd } from "@/components/seo/json-ld"
import { breadcrumbSchema, itemListSchema } from "@/lib/seo/schema"
import { products as staticProducts } from "@/lib/data/products"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

interface ProductRow {
  id: string
  name: string
  slug: string
  cas_number: string | null
  category: string | null
  classification: string | null
}

/**
 * Fetch every active product so we can render an SDS index. Server-side
 * fetch with 10-min revalidation; falls back to bundled static catalogue
 * if Supabase env vars are absent.
 */
async function getActiveProductsForSds() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return staticProducts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      cas_number: p.casNumber,
      category: p.category,
      classification: p.classification,
    })) as ProductRow[]
  }
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/products?is_active=eq.true&select=id,name,slug,cas_number,category,classification&order=name.asc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        next: { revalidate: 600 },
      },
    )
    if (!res.ok) return []
    return (await res.json()) as ProductRow[]
  } catch {
    return []
  }
}

export const metadata: Metadata = {
  title: "Safety Data Sheets (SDS) - Australian Chemical Library",
  description:
    "Download Safety Data Sheets for every chemical stocked on Chem Connect. GHS-aligned, ADG-compliant, free for ABN-registered Australian businesses.",
  alternates: { canonical: `${SITE_URL}/sds` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/sds`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "Safety Data Sheets · Chem Connect",
    description:
      "GHS-aligned SDS library for every chemical on the Chem Connect marketplace.",
    images: [
      {
        url: `${SITE_URL}/images/cqvs-logo.png`,
        width: 1200,
        height: 630,
        alt: "Chem Connect - SDS Library",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Safety Data Sheets · Chem Connect",
    description: "GHS-aligned SDS library for every chemical on the marketplace.",
    images: [`${SITE_URL}/images/cqvs-logo.png`],
  },
}

export default async function SdsIndexPage() {
  const products = await getActiveProductsForSds()

  // Group products alphabetically for easier navigation. Most chemical
  // marketplace SDS libraries follow this pattern.
  const grouped = products.reduce<Record<string, ProductRow[]>>((acc, p) => {
    const letter = p.name.charAt(0).toUpperCase()
    if (!acc[letter]) acc[letter] = []
    acc[letter].push(p)
    return acc
  }, {})
  const letters = Object.keys(grouped).sort()

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-sds-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "SDS Library", url: `${SITE_URL}/sds` },
        ])}
      />
      <JsonLd
        id="ld-sds-list"
        schema={itemListSchema({
          name: "Chem Connect SDS Library",
          items: products.map((p) => ({
            name: `${p.name} SDS`,
            url: `${SITE_URL}/products/${p.slug}#sds`,
          })),
        })}
      />

      <header className="mb-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Safety Data Sheets
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Australian SDS library
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Every chemical stocked on Chem Connect ships with a Safety Data
          Sheet (SDS) aligned to the Globally Harmonised System (GHS) and
          compliant with WHS regulations across all Australian states. Click
          any product to download its SDS.
        </p>
      </header>

      {/* Compliance summary */}
      <Card className="mb-10 border-border/60 bg-muted/30">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-5 flex-shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">GHS-aligned</p>
              <p className="text-xs text-muted-foreground">
                16-section format per WHS Code of Practice.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-5 flex-shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">ADG-compliant</p>
              <p className="text-xs text-muted-foreground">
                UN numbers + hazard class on every DG product.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-5 flex-shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">SUSMP-aware</p>
              <p className="text-xs text-muted-foreground">
                Scheduling notes where relevant under Schedules 5-7.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* A-Z navigation */}
      {letters.length > 0 && (
        <nav
          aria-label="Jump to letter"
          className="mb-8 flex flex-wrap gap-2 rounded-lg border border-border/60 bg-card p-3"
        >
          {letters.map((letter) => (
            <a
              key={letter}
              href={`#sds-${letter}`}
              className="rounded-md px-3 py-1 text-xs font-semibold uppercase text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              {letter}
            </a>
          ))}
        </nav>
      )}

      {/* Grouped product list */}
      {letters.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No products available right now. Check back shortly or browse the{" "}
          <Link href="/products" className="text-primary hover:underline">
            full catalogue
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-10">
          {letters.map((letter) => (
            <section key={letter} id={`sds-${letter}`}>
              <h2 className="mb-3 text-xl font-bold tracking-tight">
                {letter}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {grouped[letter].map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/products/${p.slug}#sds`}
                      className="group flex items-center justify-between rounded-md border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-card/80"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                          {p.name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {p.classification}
                          {p.cas_number && p.cas_number !== "N/A" && (
                            <> · CAS {p.cas_number}</>
                          )}
                        </p>
                      </div>
                      <Download className="size-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <section className="mt-14 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight">
          Can&rsquo;t find a chemical?
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          If you need an SDS for a chemical not yet on the marketplace, our
          team can source one from the manufacturer.
        </p>
        <Button variant="outline" className="mt-5" asChild>
          <Link href="/custom-orders">
            Request a custom SDS <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </section>
    </main>
  )
}
