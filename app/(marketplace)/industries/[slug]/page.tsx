import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ChevronRight } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import {
  breadcrumbSchema,
  collectionPageSchema,
  faqPageSchema,
} from "@/lib/seo/schema"
import { INDUSTRIES, getIndustryBySlug } from "@/lib/content/industries"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

interface RouteParams {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ slug: i.slug }))
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params
  const industry = getIndustryBySlug(slug)
  if (!industry) {
    return { title: "Industry Not Found", robots: { index: false } }
  }
  const title = `Chemicals for ${industry.name} - Australian B2B Supply`
  const description = industry.excerpt.slice(0, 158)

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/industries/${industry.slug}` },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/industries/${industry.slug}`,
      siteName: "Chem Connect",
      locale: "en_AU",
      title: `${industry.name} chemicals · Chem Connect`,
      description,
      images: [
        {
          url: `${SITE_URL}/images/cqvs-logo.png`,
          width: 1200,
          height: 630,
          alt: `Chemicals for ${industry.name} · Chem Connect`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${industry.name} chemicals · Chem Connect`,
      description,
      images: [`${SITE_URL}/images/cqvs-logo.png`],
    },
  }
}

export default async function IndustryPage({ params }: RouteParams) {
  const { slug } = await params
  const industry = getIndustryBySlug(slug)
  if (!industry) notFound()

  const categoryItems = industry.relevantCategorySlugs.map((c) => ({
    name: c
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
    url: `${SITE_URL}/categories/${c}`,
  }))

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-industry-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Industries", url: `${SITE_URL}/industries` },
          {
            name: industry.name,
            url: `${SITE_URL}/industries/${industry.slug}`,
          },
        ])}
      />
      <JsonLd
        id="ld-industry-collection"
        schema={collectionPageSchema({
          url: `${SITE_URL}/industries/${industry.slug}`,
          name: `${industry.name} chemicals - Chem Connect`,
          description: industry.intro,
          items: categoryItems,
        })}
      />
      <JsonLd id="ld-industry-faq" schema={faqPageSchema(industry.faqs)} />

      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/industries" className="hover:text-foreground">
          Industries
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{industry.name}</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Chemicals for{" "}
          <span className="text-primary">{industry.name}</span>
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          {industry.intro}
        </p>
      </header>

      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        {industry.highlights.map(({ title, body }) => (
          <Card key={title} className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-bold tracking-tight">
          Common applications
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {industry.useCases.map((u) => (
            <li
              key={u}
              className="rounded-md border border-border/40 bg-card px-3 py-2 text-sm text-muted-foreground"
            >
              {u}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-xl font-bold tracking-tight">
          Relevant categories
        </h2>
        <div className="flex flex-wrap gap-3">
          {categoryItems.map((c) => (
            <Link
              key={c.url}
              href={c.url.replace(SITE_URL, "")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              {c.name} <ArrowRight className="size-3" />
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-3 text-xl font-bold tracking-tight">FAQs</h2>
        <div className="space-y-3">
          {industry.faqs.map((f) => (
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
          Order for your {industry.name.toLowerCase()} operation
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Browse the standard catalogue or submit a custom request - we
          dispatch from the closest of our seven Australian hubs.
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
