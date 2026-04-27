import type { Metadata } from "next"
import Link from "next/link"
import { Mail, MessageCircle } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { breadcrumbSchema, faqPageSchema } from "@/lib/seo/schema"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

/**
 * Top-of-funnel FAQs covering the common pre-sale buyer questions:
 * shipping, freight, GST, payment, returns, dangerous-goods handling.
 * Each Q&A flows into FAQPage schema (rich-result eligible) and is also
 * fact-dense enough to get cited by AI Overviews / Perplexity.
 */
const FAQS: Array<{ question: string; answer: string }> = [
  {
    question: "How long does delivery take?",
    answer:
      "Most orders ship within 1 business day from the closest Chem Connect warehouse to your delivery address. Typical transit time is 2-5 business days metro and 3-7 business days regional. Lead times for each warehouse are listed on the relevant city page.",
  },
  {
    question: "Are prices on Chem Connect GST-inclusive?",
    answer:
      "Prices on the marketplace are listed in Australian dollars (AUD). The cart and invoice show GST as a separate line item. CQVS is a GST-registered Australian business, and all invoices are tax-compliant for ABN-holding buyers.",
  },
  {
    question: "Do I need an ABN to buy from Chem Connect?",
    answer:
      "Yes. Chem Connect is a B2B marketplace. Buyers must hold a valid Australian Business Number (ABN) and operate a legitimate business - typically concrete plants, quarries, civil contractors, manufacturers, mining sites, or laboratories.",
  },
  {
    question: "What about dangerous goods (DG) - can you ship them?",
    answer:
      "Yes. Chem Connect ships DG products through approved Australian DG-rated freight carriers compliant with the ADG Code. Each DG product page lists its UN number, hazard class, and packaging group. Some DG products are restricted to certain states based on storage and transport regulations.",
  },
  {
    question: "Can I get an SDS for every product?",
    answer:
      "Yes. Every product on Chem Connect has a Safety Data Sheet (SDS) available for download from its product page. SDS documents follow the GHS-aligned format required under WHS regulations across all Australian states.",
  },
  {
    question: "Do you offer bulk pricing or volume discounts?",
    answer:
      "Yes. Each product is sold across multiple pack sizes (typically 5 L, 20 L, 200 L drum, and 1,000 L IBC) with progressively better unit pricing. For volumes beyond standard pack sizes, use our Custom Orders form to request a quote.",
  },
  {
    question: "Can I order chemicals not listed on the marketplace?",
    answer:
      "Yes. If you need a chemical, grade, or pack size not currently listed, submit a request through the Custom Orders page. We'll source it through one of our manufacturer partners and send a quote within 1-2 business days.",
  },
  {
    question: "What's your return policy?",
    answer:
      "Due to the nature of industrial chemicals - particularly dangerous goods - we generally cannot accept returns once the seal is broken. If a product arrives damaged or doesn't match what was ordered, contact support within 48 hours and we'll arrange replacement or refund.",
  },
  {
    question: "Which payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, AMEX) via Stripe. For larger or recurring orders, account-based invoicing with NET 30 terms is available on application. Stripe processes payments under PCI-DSS Level 1 compliance.",
  },
  {
    question: "Where are Chem Connect's warehouses located?",
    answer:
      "Chem Connect operates seven dispatch hubs across Australia: Melbourne (VIC), Geelong (VIC), Brisbane / Logan (QLD), Gold Coast (QLD), Adelaide (SA), Perth (WA), and Newcastle (NSW). Sydney metro is served from the Newcastle hub with 1-2 day delivery.",
  },
  {
    question: "How do I get help with a specific order?",
    answer:
      "Email support@chemconnect.com.au with your order number. Most queries are answered within 1 business day, often the same day during business hours.",
  },
]

export const metadata: Metadata = {
  title: "Support & FAQs - Chem Connect",
  description:
    "Answers to common questions about Chem Connect - shipping, GST, dangerous-goods freight, SDS, bulk pricing, returns, and account-based ordering.",
  alternates: { canonical: `${SITE_URL}/support` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/support`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "Support & FAQs · Chem Connect",
    description:
      "Common questions answered: shipping, GST, dangerous-goods freight, SDS, bulk pricing, returns.",
    images: [
      {
        url: `${SITE_URL}/images/cqvs-logo.png`,
        width: 1200,
        height: 630,
        alt: "Chem Connect - Support & FAQs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Support & FAQs · Chem Connect",
    description:
      "Shipping, GST, DG freight, SDS, bulk pricing, returns - answered.",
    images: [`${SITE_URL}/images/cqvs-logo.png`],
  },
}

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-support-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Support", url: `${SITE_URL}/support` },
        ])}
      />
      <JsonLd id="ld-support-faq" schema={faqPageSchema(FAQS)} />

      <header className="mb-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Support &amp; FAQs
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Common questions, answered.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Most pre-sale questions are answered below. If you can&rsquo;t find
          what you need, email{" "}
          <a
            href="mailto:support@chemconnect.com.au"
            className="font-medium text-primary hover:underline"
          >
            support@chemconnect.com.au
          </a>{" "}
          - typically a 1 business-day reply.
        </p>
      </header>

      <section className="space-y-3">
        {FAQS.map((item) => (
          <details
            key={item.question}
            className="group rounded-lg border border-border/60 bg-card p-5 transition-colors hover:border-border"
          >
            <summary className="flex cursor-pointer items-start justify-between gap-4 text-base font-semibold tracking-tight">
              <span>{item.question}</span>
              <span
                aria-hidden
                className="mt-1 text-xs text-muted-foreground transition-transform group-open:rotate-180"
              >
                ▾
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </p>
          </details>
        ))}
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4 text-primary" /> Email support
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <a
              href="mailto:support@chemconnect.com.au"
              className="text-primary hover:underline"
            >
              support@chemconnect.com.au
            </a>
            <p className="mt-2">Replies in 1 business day, usually faster.</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="size-4 text-primary" /> Custom request
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Need a chemical or pack size not listed?</p>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link href="/custom-orders">Submit a custom order</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
