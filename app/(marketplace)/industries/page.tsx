import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Building2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { JsonLd } from "@/components/seo/json-ld"
import {
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/lib/seo/schema"
import { INDUSTRIES } from "@/lib/content/industries"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  title: "Industries We Supply - Australian B2B Chemical Marketplace",
  description:
    "Chem Connect supplies industrial chemicals to concrete, mining, agriculture, food & bev, water treatment, pharma, manufacturing, automotive, cleaning, and construction operations across Australia.",
  alternates: { canonical: `${SITE_URL}/industries` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/industries`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "Industries We Supply · Chem Connect",
    description:
      "Industrial chemical supply across 10 Australian industries - concrete, mining, agriculture, food & bev, water treatment, pharma, manufacturing, and more.",
    images: [
      {
        url: `${SITE_URL}/images/cqvs-logo.png`,
        width: 1200,
        height: 630,
        alt: "Industries served · Chem Connect",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Industries We Supply · Chem Connect",
    description:
      "10 Australian industries served - concrete, mining, agriculture, food & bev, water treatment, pharma, manufacturing.",
    images: [`${SITE_URL}/images/cqvs-logo.png`],
  },
}

export default function IndustriesIndexPage() {
  const items = INDUSTRIES.map((i) => ({
    name: i.name,
    url: `${SITE_URL}/industries/${i.slug}`,
  }))

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-industries-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Industries", url: `${SITE_URL}/industries` },
        ])}
      />
      <JsonLd
        id="ld-industries-collection"
        schema={collectionPageSchema({
          url: `${SITE_URL}/industries`,
          name: "Industries served - Chem Connect",
          description:
            "Industrial chemical supply across 10 Australian industries.",
          items,
        })}
      />
      <JsonLd
        id="ld-industries-list"
        schema={itemListSchema({
          name: "Industries served by Chem Connect",
          items,
        })}
      />

      <header className="mb-12">
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <Building2 className="size-3.5" />
          Industries
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Industries we supply across{" "}
          <span className="text-primary">Australia.</span>
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          From concrete plants to laboratories, mines to food-and-beverage
          manufacturers - Chem Connect dispatches industrial chemicals to{" "}
          {INDUSTRIES.length} distinct industries from seven warehouses across
          VIC, NSW, QLD, SA, WA.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {INDUSTRIES.map((industry) => (
          <Card
            key={industry.slug}
            className="group border-border/60 transition-colors hover:border-primary/40"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                <Link
                  href={`/industries/${industry.slug}`}
                  className="transition-colors hover:text-primary"
                >
                  {industry.name}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {industry.excerpt}
              </p>
              <Link
                href={`/industries/${industry.slug}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2"
              >
                See {industry.name.toLowerCase()} chemicals
                <ArrowRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  )
}
