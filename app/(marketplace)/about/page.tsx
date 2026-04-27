import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  Factory,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { breadcrumbSchema } from "@/lib/seo/schema"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  title: "About Chem Connect - Australian B2B Chemical Marketplace",
  description:
    "Chem Connect is the manufacturer-direct B2B chemicals marketplace in Australia by CQVS. Seven dispatch hubs across VIC, NSW, QLD, SA, WA. Live AUD pricing, GST-inclusive, DG-rated freight.",
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    type: "article",
    url: `${SITE_URL}/about`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "About Chem Connect · Australian B2B Chemical Marketplace",
    description:
      "Manufacturer-direct B2B chemicals marketplace by CQVS. Seven dispatch hubs across Australia.",
    images: [
      {
        url: `${SITE_URL}/images/cqvs-logo.png`,
        width: 1200,
        height: 630,
        alt: "About Chem Connect",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Chem Connect · Australian B2B Chemical Marketplace",
    description:
      "Manufacturer-direct B2B chemicals marketplace by CQVS. Seven dispatch hubs across Australia.",
    images: [`${SITE_URL}/images/cqvs-logo.png`],
  },
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-about-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "About", url: `${SITE_URL}/about` },
        ])}
      />

      {/* Hero */}
      <header className="mb-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          About Chem Connect
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Manufacturer-direct chemicals,{" "}
          <span className="text-primary">built for Australian sites.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
          Chem Connect is the B2B chemical marketplace operated by{" "}
          <strong className="text-foreground">
            Concrete &amp; Quarry Vending Systems (CQVS)
          </strong>
          . We connect concrete plants, quarries, and civil contractors with
          Australian chemical manufacturers - skipping the distributor
          markup and giving every buyer live AUD pricing, GST-inclusive
          quoting, and DG-rated freight from one of our seven dispatch hubs.
        </p>
      </header>

      {/* Pillars */}
      <section className="mb-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Factory,
            title: "Manufacturer-direct",
            body: "Every product comes straight from an Australian manufacturer. No distributor middleman, no hidden margin.",
          },
          {
            icon: Truck,
            title: "DG-rated freight",
            body: "Dangerous-goods compliant freight from seven warehouses across five states. Typically 2-5 day delivery.",
          },
          {
            icon: ShieldCheck,
            title: "Compliance-first",
            body: "Every product ships with an SDS, ADG-compliant packaging, and full GHS labelling. SUSMP scheduling respected.",
          },
          {
            icon: Users,
            title: "Built for B2B",
            body: "Live AUD pricing, GST-registered, ABN required for purchases. No quote forms, no callbacks - order online.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title} className="border-border/60">
            <CardHeader className="pb-3">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="size-5 text-primary" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* CTA */}
      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight">
          Ready to skip the middleman?
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Browse the catalogue, see live pricing, and order in minutes.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/products">
              Browse products <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/custom-orders">Need a custom order?</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
