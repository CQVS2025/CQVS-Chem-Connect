import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, Calendar, User } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { JsonLd } from "@/components/seo/json-ld"
import {
  breadcrumbSchema,
  collectionPageSchema,
  itemListSchema,
} from "@/lib/seo/schema"
import { ARTICLES, KNOWLEDGE_CATEGORIES } from "@/lib/content/knowledge"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  title: "Knowledge Hub - Buyer Guides, Compliance & Industry Insights",
  description:
    "Buyer guides, compliance explainers, and industry comparisons for Australian B2B chemical buyers. Researched and reviewed by the Chem Connect editorial team.",
  alternates: { canonical: `${SITE_URL}/knowledge` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/knowledge`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "Chem Connect Knowledge Hub",
    description:
      "Buyer guides, compliance explainers, and industry comparisons for Australian B2B chemical buyers.",
    images: [
      {
        url: `${SITE_URL}/images/cqvs-logo.png`,
        width: 1200,
        height: 630,
        alt: "Chem Connect Knowledge Hub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chem Connect Knowledge Hub",
    description:
      "Buyer guides, compliance explainers, and industry comparisons.",
    images: [`${SITE_URL}/images/cqvs-logo.png`],
  },
}

export default function KnowledgeIndexPage() {
  // Sort newest-first so updates surface to crawlers and users.
  const articles = [...ARTICLES].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )

  // Group by category for the visual layout while keeping the date sort
  // within each group.
  const groupedByCategory = (
    Object.keys(KNOWLEDGE_CATEGORIES) as Array<keyof typeof KNOWLEDGE_CATEGORIES>
  )
    .map((category) => ({
      category,
      label: KNOWLEDGE_CATEGORIES[category],
      articles: articles.filter((a) => a.category === category),
    }))
    .filter((g) => g.articles.length > 0)

  const articleListItems = articles.map((a) => ({
    name: a.title,
    url: `${SITE_URL}/knowledge/${a.slug}`,
  }))

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-knowledge-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Knowledge Hub", url: `${SITE_URL}/knowledge` },
        ])}
      />
      <JsonLd
        id="ld-knowledge-collection"
        schema={collectionPageSchema({
          url: `${SITE_URL}/knowledge`,
          name: "Chem Connect Knowledge Hub",
          description:
            "Buyer guides, compliance explainers, and industry comparisons for Australian B2B chemical buyers.",
          items: articleListItems,
        })}
      />
      <JsonLd
        id="ld-knowledge-list"
        schema={itemListSchema({
          name: "Chem Connect Knowledge Hub articles",
          items: articleListItems,
        })}
      />

      <header className="mb-14">
        <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <BookOpen className="size-3.5" />
          Knowledge Hub
        </p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Researched answers for{" "}
          <span className="text-primary">B2B chemical buyers.</span>
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          Buyer guides, compliance explainers, and industry comparisons.
          Written for procurement managers, plant operators, and lab
          coordinators in concrete, quarry, manufacturing, and laboratory
          operations across Australia.
        </p>
      </header>

      {groupedByCategory.map(({ category, label, articles: list }) => (
        <section key={category} className="mb-14">
          <h2 className="mb-4 text-xl font-bold tracking-tight">{label}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((a) => (
              <Card
                key={a.slug}
                className="group border-border/60 transition-colors hover:border-primary/40"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base leading-snug">
                    <Link
                      href={`/knowledge/${a.slug}`}
                      className="transition-colors hover:text-primary"
                    >
                      {a.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{a.excerpt}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(a.publishedAt).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3" />
                      {a.author}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {a.tags.slice(0, 3).map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="text-[10px] capitalize"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <Link
                    href={`/knowledge/${a.slug}`}
                    className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-primary hover:gap-2"
                  >
                    Read article
                    <ArrowRight className="size-3.5" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
