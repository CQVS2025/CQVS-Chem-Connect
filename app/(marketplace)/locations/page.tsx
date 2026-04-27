import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, MapPin, Phone } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { JsonLd } from "@/components/seo/json-ld"
import {
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/lib/seo/schema"
import {
  STATE_NAMES,
  SYDNEY_COVERAGE,
  getActiveWarehouses,
} from "@/lib/seo/warehouses"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  title: "Australian Chemical Dispatch Hubs - VIC, NSW, QLD, SA, WA",
  description:
    "Chem Connect operates seven dispatch hubs across Australia - Melbourne, Geelong, Brisbane, Gold Coast, Adelaide, Perth, Newcastle. Plus 1-2 day Sydney coverage from Newcastle.",
  alternates: { canonical: `${SITE_URL}/locations` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/locations`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "Australian Chemical Dispatch Hubs · Chem Connect",
    description:
      "Seven dispatch hubs across VIC, NSW, QLD, SA, WA - fast freight from the warehouse closest to your site.",
    images: [
      {
        url: `${SITE_URL}/images/cqvs-logo.png`,
        width: 1200,
        height: 630,
        alt: "Chem Connect - Australian Dispatch Hubs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Australian Chemical Dispatch Hubs · Chem Connect",
    description:
      "Seven dispatch hubs across VIC, NSW, QLD, SA, WA. 1-2 day Sydney coverage from Newcastle.",
    images: [`${SITE_URL}/images/cqvs-logo.png`],
  },
}

export default function LocationsPage() {
  const warehouses = getActiveWarehouses()

  // Group by state for the visual layout. State order matches the AU
  // population centres pattern (most-populous first) so VIC / NSW lead.
  const stateOrder: Array<keyof typeof STATE_NAMES> = [
    "VIC",
    "NSW",
    "QLD",
    "SA",
    "WA",
  ]
  const grouped = stateOrder
    .map((state) => ({
      state,
      stateName: STATE_NAMES[state],
      warehouses: warehouses.filter((w) => w.state === state),
    }))
    .filter((g) => g.warehouses.length > 0)

  // Schema items: every active warehouse + Sydney coverage page.
  const allCityItems = [
    ...warehouses.map((w) => ({
      name: `Chemical supplier ${w.city}`,
      url: `${SITE_URL}/chemical-supplier/${w.slug}`,
    })),
    {
      name: `Chemical delivery ${SYDNEY_COVERAGE.city}`,
      url: `${SITE_URL}/chemical-supplier/${SYDNEY_COVERAGE.slug}`,
    },
  ]

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-locations-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Locations", url: `${SITE_URL}/locations` },
        ])}
      />
      <JsonLd
        id="ld-locations-collection"
        schema={collectionPageSchema({
          url: `${SITE_URL}/locations`,
          name: "Chem Connect - Australian dispatch hubs",
          description:
            "Seven active warehouses across VIC, NSW, QLD, SA, WA, plus 1-2 day delivery to Sydney metro from Newcastle.",
          items: allCityItems,
        })}
      />
      <JsonLd
        id="ld-locations-list"
        schema={itemListSchema({
          name: "Chem Connect dispatch hubs",
          items: allCityItems,
        })}
      />

      <header className="mb-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Locations
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Seven dispatch hubs.{" "}
          <span className="text-primary">Five Australian states.</span>
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          Chem Connect dispatches industrial chemicals from seven physical
          warehouses across VIC, NSW, QLD, SA, and WA. Pick the hub closest
          to your site for the fastest lead time, or use our Sydney coverage
          page if you&rsquo;re in NSW metro.
        </p>
      </header>

      {/* State-grouped hub list */}
      <section className="space-y-12">
        {grouped.map(({ state, stateName, warehouses: stateWarehouses }) => (
          <div key={state}>
            <h2 className="mb-4 flex items-center gap-3 text-xl font-bold tracking-tight">
              <span>{stateName}</span>
              <Badge variant="secondary" className="font-mono">
                {state}
              </Badge>
              <span className="text-sm font-normal text-muted-foreground">
                · {stateWarehouses.length} warehouse
                {stateWarehouses.length === 1 ? "" : "s"}
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stateWarehouses.map((w) => (
                <Card
                  key={w.slug}
                  className="group border-border/60 transition-colors hover:border-primary/40"
                >
                  <CardHeader className="pb-3">
                    <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                      <MapPin className="size-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">{w.city}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {w.name && (
                      <p className="font-medium text-foreground">{w.name}</p>
                    )}
                    <p className="text-muted-foreground">
                      {w.street}
                      <br />
                      {w.suburb} {w.state} {w.postcode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Coverage: {w.coverage.slice(0, 3).join(" · ")}
                    </p>
                    <Link
                      href={`/chemical-supplier/${w.slug}`}
                      className="inline-flex items-center gap-1 pt-2 text-sm font-semibold text-primary transition-colors hover:gap-2"
                    >
                      View {w.city} hub
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Sydney coverage callout */}
      <section className="mt-14 rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Sydney coverage
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              No Sydney warehouse - but full Sydney delivery.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Chem Connect dispatches to Sydney metro within 1-2
              business days from our Newcastle hub at Cardiff. Honest,
              straightforward freight - no fake addresses.
            </p>
          </div>
          <Link
            href={`/chemical-supplier/${SYDNEY_COVERAGE.slug}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Sydney delivery details <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Contact strip */}
      <section className="mt-10 flex flex-col items-center gap-2 rounded-lg border border-border/60 bg-card p-6 text-center text-sm">
        <Phone className="size-5 text-primary" />
        <p className="font-semibold">Need help picking a hub?</p>
        <p className="text-muted-foreground">
          Email{" "}
          <a
            href="mailto:support@chemconnect.com.au"
            className="text-primary hover:underline"
          >
            support@chemconnect.com.au
          </a>{" "}
          and we&rsquo;ll route your enquiry to the closest warehouse.
        </p>
      </section>
    </main>
  )
}
