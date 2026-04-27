import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight, Calendar, User } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { JsonLd } from "@/components/seo/json-ld"
import { articleSchema, breadcrumbSchema } from "@/lib/seo/schema"
import {
  ARTICLES,
  KNOWLEDGE_CATEGORIES,
  getArticleBySlug,
} from "@/lib/content/knowledge"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

interface RouteParams {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }))
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) {
    return { title: "Article Not Found", robots: { index: false } }
  }
  return {
    title: article.title,
    description: article.excerpt.slice(0, 158),
    alternates: { canonical: `${SITE_URL}/knowledge/${article.slug}` },
    openGraph: {
      type: "article",
      url: `${SITE_URL}/knowledge/${article.slug}`,
      siteName: "Chem Connect",
      locale: "en_AU",
      title: article.title,
      description: article.excerpt,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.author],
      tags: article.tags,
      images: [
        {
          url: `${SITE_URL}/images/cqvs-logo.png`,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [`${SITE_URL}/images/cqvs-logo.png`],
    },
  }
}

/**
 * Lightweight Markdown-ish renderer. Articles use a tight subset:
 *   ## H2 headings
 *   - bullet lists
 *   **bold inline**
 * Anything more complex belongs in a real CMS - at that scale we'd swap
 * this for `react-markdown` or MDX.
 */
function renderBody(body: string) {
  return body.split(/\n\n+/).map((block, idx) => {
    if (block.startsWith("## ")) {
      return (
        <h2 key={idx} className="mt-10 mb-4 text-2xl font-bold tracking-tight">
          {block.replace(/^##\s+/, "")}
        </h2>
      )
    }
    if (/^- /m.test(block)) {
      return (
        <ul
          key={idx}
          className="my-4 list-disc space-y-1 pl-6 text-base text-muted-foreground"
        >
          {block.split("\n").map((line, i) => (
            <li
              key={i}
              dangerouslySetInnerHTML={{
                __html: line
                  .replace(/^-\s+/, "")
                  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
              }}
            />
          ))}
        </ul>
      )
    }
    return (
      <p
        key={idx}
        className="my-4 text-base leading-relaxed text-muted-foreground"
        dangerouslySetInnerHTML={{
          __html: block.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
        }}
      />
    )
  })
}

export default async function KnowledgeArticlePage({ params }: RouteParams) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const url = `${SITE_URL}/knowledge/${article.slug}`
  const formattedPublished = new Date(article.publishedAt).toLocaleDateString(
    "en-AU",
    { day: "numeric", month: "long", year: "numeric" },
  )

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <JsonLd
        id="ld-knowledge-breadcrumb"
        schema={breadcrumbSchema([
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Knowledge Hub", url: `${SITE_URL}/knowledge` },
          { name: article.title, url },
        ])}
      />
      <JsonLd
        id="ld-knowledge-article"
        schema={articleSchema({
          baseUrl: SITE_URL,
          url,
          headline: article.title,
          description: article.excerpt,
          datePublished: article.publishedAt,
          dateModified: article.updatedAt,
          authorName: article.author,
        })}
      />

      <Link
        href="/knowledge"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Knowledge Hub
      </Link>

      <header className="mb-8 border-b border-border/60 pb-6">
        <Badge variant="secondary" className="mb-4 text-xs">
          {KNOWLEDGE_CATEGORIES[article.category]}
        </Badge>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{article.excerpt}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="size-3.5" />
            {article.author}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3.5" />
            Published {formattedPublished}
          </span>
          {article.updatedAt !== article.publishedAt && (
            <>
              <span>·</span>
              <span>
                Updated{" "}
                {new Date(article.updatedAt).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="prose prose-neutral max-w-none">
        {renderBody(article.body)}
      </div>

      {/* Tags */}
      <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-border/60 pt-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tags
        </span>
        {article.tags.map((t) => (
          <Badge key={t} variant="outline" className="text-xs capitalize">
            {t}
          </Badge>
        ))}
      </div>

      {/* Related products (optional) */}
      {article.relatedProductSlugs && article.relatedProductSlugs.length > 0 && (
        <section className="mt-10 rounded-2xl border border-border/60 bg-card p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Related products
          </h3>
          <ul className="space-y-2">
            {article.relatedProductSlugs.map((s) => (
              <li key={s}>
                <Link
                  href={`/products/${s}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2"
                >
                  View product on Chem Connect <ArrowRight className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
