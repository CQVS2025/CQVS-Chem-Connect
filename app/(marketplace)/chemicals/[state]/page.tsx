import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, MapPin, Truck } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import {
  breadcrumbSchema,
  collectionPageSchema,
  faqPageSchema,
} from "@/lib/seo/schema"
import {
  STATE_NAMES,
  SYDNEY_COVERAGE,
  type WarehouseLocation,
  getWarehousesByState,
} from "@/lib/seo/warehouses"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

const STATE_SLUGS = ["nsw", "vic", "qld", "sa", "wa"] as const
type StateSlug = (typeof STATE_SLUGS)[number]

function isValidStateSlug(s: string): s is StateSlug {
  return (STATE_SLUGS as readonly string[]).includes(s)
}

interface RouteParams {
  params: Promise<{ state: string }>
}

export function generateStaticParams() {
  return STATE_SLUGS.map((state) => ({ state }))
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { state } = await params
  if (!isValidStateSlug(state)) {
    return { title: "Not Found", robots: { index: false } }
  }
  const stateCode = state.toUpperCase() as keyof typeof STATE_NAMES
  const stateName = STATE_NAMES[stateCode]

  const title = `Bulk Industrial Chemicals ${stateName} (${stateCode}) - Chem Connect`
  const description = `Manufacturer-direct industrial chemicals across ${stateName}. AUD pricing, GST-inclusive, DG-rated freight from local Chem Connect dispatch hubs.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/chemicals/${state}` },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/chemicals/${state}`,
      siteName: "Chem Connect",
      locale: "en_AU",
      title,
      description,
      images: [
        {
          url: `${SITE_URL}/images/cqvs-logo.png`,
          width: 1200,
          height: 630,
          alt: `Industrial chemicals ${stateName}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${SITE_URL}/images/cqvs-logo.png`],
    },
  }
}

function buildStateFaqs(
  stateName: string,
  stateCode: string,
  warehouses: WarehouseLocation[],
): Array<{ question: string; answer: string }> {
  const hubList = warehouses
    .map((w) => `${w.city} (${w.suburb})`)
    .join(", ")

  return [
    {
      question: `Where does Chem Connect dispatch from in ${stateName}?`,
      answer:
        warehouses.length > 0
          ? `${stateName} orders are dispatched from our local hubs: ${hubList}. Each city has its own page with detailed coverage and lead times.`
          : `${stateName} orders are dispatched from the closest interstate Chem Connect hub. See our locations page for the full list.`,
    },
    {
      question: `How long does delivery take in ${stateName}?`,
      answer: `Most ${stateName} metro orders arrive within 2-4 business days. Regional and remote areas typically take 4-7 business days. Each city page lists per-suburb lead times.`,
    },
    {
      question: `Are dangerous goods (DG) shipped within ${stateName}?`,
      answer: `Yes. DG products ship through approved Australian DG-rated freight carriers compliant with the ADG Code. State-specific storage or transport restrictions are flagged on each product page.`,
    },
    {
      question: `Are prices GST-inclusive for ${stateCode} buyers?`,
      answer:
        "Prices are listed in AUD on the marketplace. GST is shown as a separate line in the cart. Invoices are tax-compliant for ABN-holding Australian businesses regardless of state.",
    },
  ]
}

export default async function StatePage({ params }: RouteParams) {
  const { state } = await params
  if (!isValidStateSlug(state)) notFound()

  const stateCode = state.toUpperCase() as keyof typeof STATE_NAMES
  const stateName = STATE_NAMES[stateCode]
  const warehouses = getWarehousesByState(stateCode)

  // NSW gets the Sydney coverage page surfaced even though it's not a
  // physical warehouse - same as how the locations hub does it.
  const includesSydney = stateCode === "NSW"

  const cityItems = [
    ...warehouses.map((w) => ({
      name: `Chemical supplier ${w.city}`,
      url: `${SITE_URL}/chemical-supplier/${w.slug}`,
    })),
    ...(includesSydney
      ? [
          {
            name: `Chemical delivery ${SYDNEY_COVERAGE.city}`,
            url: `${SITE_URL}/chemical-supplier/${SYDNEY_COVERAGE.slug}`,
          },
        ]
      : []),
  ]

  const faqs = buildStateFaqs(stateName, stateCode, warehouses)

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-state-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Locations", url: `${SITE_URL}/locations` },
          { name: stateName, url: `${SITE_URL}/chemicals/${state}` },
        ])}
      />
      <JsonLd
        id="ld-state-collection"
        schema={collectionPageSchema({
          url: `${SITE_URL}/chemicals/${state}`,
          name: `Industrial chemicals - ${stateName}`,
          description: `Chem Connect delivery and dispatch coverage across ${stateName}.`,
          items: cityItems,
        })}
      />
      <JsonLd id="ld-state-faq" schema={faqPageSchema(faqs)} />

      <header className="mb-10">
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {stateName}
          <Badge variant="secondary" className="font-mono">
            {stateCode}
          </Badge>
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Bulk industrial chemicals across{" "}
          <span className="text-primary">{stateName}</span>.
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          {warehouses.length > 0
            ? `Chem Connect operates ${warehouses.length} dispatch hub${warehouses.length === 1 ? "" : "s"} in ${stateName}, supplying concrete plants, quarries, civil contractors, and laboratories with manufacturer-direct chemicals.`
            : `${stateName} orders are dispatched from the closest interstate Chem Connect hub with DG-rated freight.`}
        </p>
      </header>

      {/* Cities in this state */}
      <section className="mb-12">
        <h2 className="mb-4 text-xl font-bold tracking-tight">
          Dispatch hubs in {stateName}
        </h2>
        {warehouses.length === 0 && !includesSydney ? (
          <p className="rounded-md border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
            No physical Chem Connect warehouse in {stateName} yet. We
            dispatch from the closest interstate hub.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {warehouses.map((w) => (
              <Card
                key={w.slug}
                className="group border-border/60 transition-colors hover:border-primary/40"
              >
                <CardHeader className="pb-3">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <MapPin className="size-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{w.city}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {w.name && (
                    <p className="text-sm font-medium">{w.name}</p>
                  )}
                  <p className="text-muted-foreground">
                    {w.street}
                    <br />
                    {w.suburb} {w.state} {w.postcode}
                  </p>
                  <Link
                    href={`/chemical-supplier/${w.slug}`}
                    className="inline-flex items-center gap-1 pt-2 text-sm font-semibold text-primary hover:gap-2"
                  >
                    View {w.city} hub
                    <ArrowRight className="size-3.5" />
                  </Link>
                </CardContent>
              </Card>
            ))}
            {includesSydney && (
              <Card className="group border-border/60 bg-amber-50/30 transition-colors hover:border-primary/40 dark:bg-amber-950/10">
                <CardHeader className="pb-3">
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <Truck className="size-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">
                    {SYDNEY_COVERAGE.city}{" "}
                    <Badge
                      variant="outline"
                      className="ml-1 align-middle text-[9px]"
                    >
                      served from Newcastle
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    1-2 day delivery from our Cardiff / Newcastle hub. No
                    Sydney warehouse.
                  </p>
                  <Link
                    href={`/chemical-supplier/${SYDNEY_COVERAGE.slug}`}
                    className="inline-flex items-center gap-1 pt-2 text-sm font-semibold text-primary hover:gap-2"
                  >
                    Sydney delivery details
                    <ArrowRight className="size-3.5" />
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>

      <section className="mb-12">
        <h2 className="mb-3 text-xl font-bold tracking-tight">FAQs</h2>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details
              key={f.question}
              className="group rounded-lg border border-border/60 bg-card p-4"
            >
              <summary className="cursor-pointer text-sm font-semibold">
                {f.question}
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight">
          Browse {stateName} products
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Filter the catalogue by {stateCode} stock - see what&rsquo;s
          available for fast local dispatch.
        </p>
        <Button className="mt-5" asChild>
          <Link href={`/products?region=${stateCode}`}>
            Browse {stateCode} products <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </section>
    </main>
  )
}
