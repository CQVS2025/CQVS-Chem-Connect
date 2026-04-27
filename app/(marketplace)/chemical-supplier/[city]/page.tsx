import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  Truck,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import {
  breadcrumbSchema,
  faqPageSchema,
  localBusinessSchema,
  serviceSchema,
} from "@/lib/seo/schema"
import {
  STATE_NAMES,
  SYDNEY_COVERAGE,
  WAREHOUSES,
  getActiveWarehouses,
  getWarehouseBySlug,
} from "@/lib/seo/warehouses"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

interface RouteParams {
  params: Promise<{ city: string }>
}

/**
 * Pre-render every active warehouse city + the Sydney coverage page.
 * Eight static slugs total. Anything else 404s.
 */
export function generateStaticParams() {
  return [
    ...getActiveWarehouses().map((w) => ({ city: w.slug })),
    { city: SYDNEY_COVERAGE.slug },
  ]
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { city } = await params

  // Sydney coverage gets its own metadata since we don't have a warehouse
  // there - honest "served from Newcastle" framing.
  if (city === SYDNEY_COVERAGE.slug) {
    return {
      title: `Chemical Supplier ${SYDNEY_COVERAGE.city} - 1-2 Day Delivery from Newcastle`,
      description: `${SYDNEY_COVERAGE.description} Manufacturer-direct industrial chemicals, GST-inclusive, AUD pricing.`,
      alternates: {
        canonical: `${SITE_URL}/chemical-supplier/${SYDNEY_COVERAGE.slug}`,
      },
      openGraph: {
        type: "website",
        url: `${SITE_URL}/chemical-supplier/${SYDNEY_COVERAGE.slug}`,
        siteName: "Chem Connect",
        locale: "en_AU",
        title: `Chemical Supplier ${SYDNEY_COVERAGE.city} · Chem Connect`,
        description: SYDNEY_COVERAGE.description,
        images: [
          {
            url: `${SITE_URL}/images/cqvs-logo.png`,
            width: 1200,
            height: 630,
            alt: `Chem Connect - ${SYDNEY_COVERAGE.city} delivery`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `Chemical Supplier ${SYDNEY_COVERAGE.city} · Chem Connect`,
        description: SYDNEY_COVERAGE.description,
        images: [`${SITE_URL}/images/cqvs-logo.png`],
      },
    }
  }

  const warehouse = getWarehouseBySlug(city)
  if (!warehouse) {
    return { title: "Not Found", robots: { index: false } }
  }

  const title = `Chemical Supplier ${warehouse.city} - Bulk Industrial Chemicals ${warehouse.state}`
  const description = warehouse.description.slice(0, 158)

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/chemical-supplier/${warehouse.slug}`,
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/chemical-supplier/${warehouse.slug}`,
      siteName: "Chem Connect",
      locale: "en_AU",
      title: `Chemical Supplier ${warehouse.city} · Chem Connect`,
      description,
      images: [
        {
          url: `${SITE_URL}/images/cqvs-logo.png`,
          width: 1200,
          height: 630,
          alt: `Chem Connect - ${warehouse.city} dispatch hub`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Chemical Supplier ${warehouse.city} · Chem Connect`,
      description,
      images: [`${SITE_URL}/images/cqvs-logo.png`],
    },
  }
}

/**
 * Build the per-city FAQ block. Generic shipping / GST questions are
 * shared, but the warehouse-specific lead time + coverage answers are
 * dynamically composed from the warehouse data.
 */
function buildCityFaqs(
  cityLabel: string,
  state: string,
  coverage: string[],
  isCoverageOnly = false,
): Array<{ question: string; answer: string }> {
  const lead = isCoverageOnly
    ? "Sydney metro receives delivery within 1-2 business days from our Newcastle warehouse at Cardiff (~140 km north of Sydney CBD)."
    : `Most ${cityLabel} orders ship within 1 business day from our local warehouse and arrive within 2-3 business days metro and 3-5 business days regional.`

  return [
    {
      question: `How fast is delivery to ${cityLabel}?`,
      answer: lead,
    },
    {
      question: `Which suburbs around ${cityLabel} do you cover?`,
      answer: `Coverage from this hub includes ${coverage.join(", ")}. Outside this area is still available - freight may take an extra 1-2 days.`,
    },
    {
      question: `Are prices GST-inclusive?`,
      answer:
        "Prices are listed in AUD on the marketplace. The cart shows GST as a separate line; invoices are tax-compliant for ABN-holding buyers. Chem Connect's parent company, CQVS, is GST-registered.",
    },
    {
      question: `Do you ship dangerous goods to ${state}?`,
      answer: `Yes. Chem Connect ships DG products through approved Australian DG-rated freight carriers compliant with the ADG Code. Some products may have state-specific storage or transport restrictions; these are flagged on each product page.`,
    },
    {
      question: `Can I pick up from the ${cityLabel} warehouse?`,
      answer:
        "Pickup is generally not offered to keep dispatch quick and consistent. For very large or urgent orders, contact support@chemconnect.com.au and we'll see what's possible.",
    },
  ]
}

export default async function CityLandingPage({ params }: RouteParams) {
  const { city } = await params

  // ────────────────────── Sydney coverage variant ──────────────────────
  if (city === SYDNEY_COVERAGE.slug) {
    const dispatchHub = WAREHOUSES.find(
      (w) => w.slug === SYDNEY_COVERAGE.dispatchedFromSlug,
    )
    const faqs = buildCityFaqs(
      SYDNEY_COVERAGE.city,
      SYDNEY_COVERAGE.state,
      SYDNEY_COVERAGE.coverage,
      true,
    )

    return (
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <JsonLd
          id="ld-city-breadcrumb"
          schema={breadcrumbSchema([
            { name: "Home", url: `${SITE_URL}/` },
            { name: "Locations", url: `${SITE_URL}/locations` },
            {
              name: SYDNEY_COVERAGE.city,
              url: `${SITE_URL}/chemical-supplier/${SYDNEY_COVERAGE.slug}`,
            },
          ])}
        />
        <JsonLd
          id="ld-city-service"
          schema={serviceSchema({
            baseUrl: SITE_URL,
            slug: SYDNEY_COVERAGE.slug,
            name: `Industrial chemical supply - ${SYDNEY_COVERAGE.city}`,
            description: SYDNEY_COVERAGE.description,
            serviceArea: SYDNEY_COVERAGE.city,
          })}
        />
        <JsonLd id="ld-city-faq" schema={faqPageSchema(faqs)} />

        <header className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {SYDNEY_COVERAGE.city} · {STATE_NAMES[SYDNEY_COVERAGE.state]}
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Chemical supplier serving{" "}
            <span className="text-primary">{SYDNEY_COVERAGE.city}.</span>
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            {SYDNEY_COVERAGE.description}
          </p>
        </header>

        <Card className="mb-10 border-border/60 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="p-6">
            <p className="mb-2 text-sm font-semibold">
              Honest framing - no Sydney warehouse
            </p>
            <p className="text-sm text-muted-foreground">
              Chem Connect doesn&rsquo;t operate a physical warehouse in
              Sydney. Sydney metro orders dispatch from the{" "}
              {dispatchHub ? (
                <Link
                  href={`/chemical-supplier/${dispatchHub.slug}`}
                  className="font-medium text-primary hover:underline"
                >
                  Newcastle hub at {dispatchHub.suburb}
                </Link>
              ) : (
                "Newcastle hub"
              )}
              , approximately 140 km north of Sydney CBD - well within
              next-day freight territory. We&rsquo;d rather be upfront about
              this than pretend otherwise.
            </p>
          </CardContent>
        </Card>

        <section className="mb-10 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Truck, label: "1-2 day delivery", body: "From Newcastle to Sydney metro" },
            { icon: Clock, label: "Same-day dispatch", body: "Order before 12pm" },
            { icon: CheckCircle2, label: "DG-compliant freight", body: "ADG Code rated carriers" },
          ].map(({ icon: Icon, label, body }) => (
            <Card key={label} className="border-border/60">
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-xl font-bold tracking-tight">
            Sydney delivery coverage
          </h2>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            {SYDNEY_COVERAGE.coverage.map((area) => (
              <li
                key={area}
                className="flex items-center gap-2 rounded-md border border-border/40 bg-card px-3 py-2"
              >
                <MapPin className="size-3.5 text-primary" /> {area}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
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
            Order for delivery to {SYDNEY_COVERAGE.city}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Browse the catalogue, see live AUD pricing, order online - most
            Sydney orders arrive within 2 business days.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/products">
                Browse products <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/locations">All Australian hubs</Link>
            </Button>
          </div>
        </section>
      </main>
    )
  }

  // ────────────────────── Standard warehouse city ──────────────────────
  const warehouse = getWarehouseBySlug(city)
  if (!warehouse) notFound()

  const faqs = buildCityFaqs(warehouse.city, warehouse.state, warehouse.coverage)
  const stateName = STATE_NAMES[warehouse.state]

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-city-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Locations", url: `${SITE_URL}/locations` },
          {
            name: warehouse.city,
            url: `${SITE_URL}/chemical-supplier/${warehouse.slug}`,
          },
        ])}
      />
      <JsonLd
        id="ld-city-localbusiness"
        schema={localBusinessSchema({
          baseUrl: SITE_URL,
          slug: warehouse.slug,
          name: warehouse.name ?? `Chem Connect ${warehouse.city}`,
          street: warehouse.street,
          suburb: warehouse.suburb,
          state: warehouse.state,
          postcode: warehouse.postcode,
          description: warehouse.description,
          servesCity: warehouse.city,
          openingHours: warehouse.openingHours,
        })}
      />
      <JsonLd id="ld-city-faq" schema={faqPageSchema(faqs)} />

      <header className="mb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {warehouse.city} ·{" "}
          <span className="text-muted-foreground">{stateName}</span>
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Chemical supplier in{" "}
          <span className="text-primary">{warehouse.city}</span>.
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          {warehouse.description}
        </p>
      </header>

      {/* Warehouse card */}
      <Card className="mb-10 border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">
                {warehouse.name ?? `${warehouse.city} dispatch hub`}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {warehouse.suburb} · {warehouse.state} · {warehouse.postcode}
              </p>
            </div>
            <Badge variant="secondary">Active</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Address
            </p>
            <p className="mt-1 text-sm">
              {warehouse.street}
              <br />
              {warehouse.suburb} {warehouse.state} {warehouse.postcode}
              <br />
              Australia
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Opening hours
            </p>
            <p className="mt-1 text-sm">
              Mon-Fri · 8:00 AM - 5:00 PM
              <br />
              <span className="text-muted-foreground">
                Closed weekends &amp; public holidays
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Coverage area */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl font-bold tracking-tight">
          Areas we serve from {warehouse.city}
        </h2>
        <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground sm:grid-cols-3">
          {warehouse.coverage.map((area) => (
            <li
              key={area}
              className="flex items-center gap-2 rounded-md border border-border/40 bg-card px-3 py-2"
            >
              <MapPin className="size-3.5 text-primary" /> {area}
            </li>
          ))}
        </ul>
      </section>

      {/* Trust strip */}
      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Truck,
            label: "DG-rated freight",
            body: `Compliant carriers across ${stateName}`,
          },
          {
            icon: Clock,
            label: "Fast dispatch",
            body: "Most orders ship within 1 business day",
          },
          {
            icon: CheckCircle2,
            label: "GST-inclusive",
            body: "AUD pricing, ABN required",
          },
        ].map(({ icon: Icon, label, body }) => (
          <Card key={label} className="border-border/60">
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className="size-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{body}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* FAQs */}
      <section className="mb-10">
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

      {/* CTA */}
      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight">
          Order from {warehouse.city}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Browse the catalogue and see live AUD pricing - most {warehouse.city}{" "}
          orders ship same-day.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/products?region=${warehouse.state}`}>
              Browse {warehouse.state} products{" "}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="mailto:support@chemconnect.com.au">
              <Mail className="mr-2 size-4" /> Contact support
            </a>
          </Button>
        </div>
      </section>
    </main>
  )
}
