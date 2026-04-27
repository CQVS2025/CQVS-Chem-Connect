import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  Package,
  ShieldCheck,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { breadcrumbSchema, serviceSchema } from "@/lib/seo/schema"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  title: "Custom Chemical Orders - Bulk, Custom Grades & Pack Sizes",
  description:
    "Need a chemical, grade, or pack size not listed on Chem Connect? Submit a custom order and we'll source it through our manufacturer partners. Quotes within 1-2 business days.",
  alternates: { canonical: `${SITE_URL}/custom-orders` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/custom-orders`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "Custom Chemical Orders · Chem Connect",
    description:
      "Custom chemical sourcing - formulations, grades, and pack sizes not listed on the marketplace. Quotes within 1-2 business days.",
    images: [
      {
        url: `${SITE_URL}/images/cqvs-logo.png`,
        width: 1200,
        height: 630,
        alt: "Custom Chemical Orders · Chem Connect",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Custom Chemical Orders · Chem Connect",
    description:
      "Custom chemical sourcing - formulations, grades, and pack sizes not listed on the marketplace.",
    images: [`${SITE_URL}/images/cqvs-logo.png`],
  },
}

export default function CustomOrdersPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-custom-orders-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Custom Orders", url: `${SITE_URL}/custom-orders` },
        ])}
      />
      <JsonLd
        id="ld-custom-orders-service"
        schema={serviceSchema({
          baseUrl: SITE_URL,
          slug: "custom-orders",
          name: "Custom chemical sourcing",
          description:
            "Bespoke industrial chemical sourcing for Australian businesses - formulations, grades, and pack sizes outside the standard catalogue.",
          serviceArea: "Australia",
        })}
      />

      <header className="mb-14">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Custom Orders
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Need something{" "}
          <span className="text-primary">not on the marketplace?</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Chem Connect&rsquo;s manufacturer partners can supply chemicals,
          grades, and pack sizes that aren&rsquo;t in the standard catalogue.
          Tell us what you need and we&rsquo;ll come back with a quote within
          1-2 business days.
        </p>
      </header>

      <section className="mb-14 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Package,
            title: "Custom pack sizes",
            body: "Anything from sample sizes to bulk tankers. Pre-mixed blends, custom dilutions, or ISO tanker shipments.",
          },
          {
            icon: ShieldCheck,
            title: "Specialised grades",
            body: "Lab grade, technical grade, food grade, USP / BP / EP grades - all sourced through certified Australian manufacturers.",
          },
          {
            icon: Clock,
            title: "Fast turnaround",
            body: "Most custom requests get a sourcing quote in 1-2 business days. Production lead times vary by chemical.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title} className="border-border/60">
            <CardHeader>
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                <Icon className="size-4 text-primary" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Lead-capture CTA - until a custom-order form is wired, route to email. */}
      <section className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-10">
        <h2 className="text-2xl font-bold tracking-tight">
          Submit a custom request
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Email a brief with the chemical name, grade, pack size, and target
          volume. Reply usually within 1 business day.
        </p>
        <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
          {[
            "Chemical name + CAS number (if known)",
            "Required grade (technical, lab, food, etc.)",
            "Pack size and total volume",
            "Delivery state / postcode",
            "Any compliance notes (food contact, pharma, etc.)",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 flex-shrink-0 text-primary" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <a href="mailto:support@chemconnect.com.au?subject=Custom%20order%20request">
              <Mail className="mr-2 size-4" /> Email custom request
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/products">
              Browse standard catalogue <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
