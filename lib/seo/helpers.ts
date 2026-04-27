/**
 * Small SEO utilities reused across page templates. Keep these pure and
 * dependency-free so they can be called from server and client components.
 */

interface AltInput {
  name: string
  category?: string | null
  manufacturer?: string | null
  /** When the image is associated with a state / city / surface, pass it
   *  so the alt text picks up the local-search keyword. */
  qualifier?: string | null
}

/**
 * Build descriptive image alt text from product / context fields.
 *
 * Used as a fallback whenever a product row does not yet have an
 * explicit `image_alt` value. Example outputs:
 *   "Green Acid Replacement - Acid Replacement - CQVS Chemical"
 *   "AdBlue (DEF) - Automotive - CQVS Chemical - Victoria"
 *
 * Order matters: product name first (the strongest keyword), then the
 * specific qualifier, then category and manufacturer. Trims to under 125
 * characters because Google ignores anything past that.
 */
export function deriveImageAlt(input: AltInput): string {
  const parts = [input.name]
  if (input.qualifier) parts.push(input.qualifier)
  if (input.category) parts.push(input.category)
  if (input.manufacturer) parts.push(input.manufacturer)
  const joined = parts.filter(Boolean).join(" - ")
  return joined.length > 125 ? `${joined.slice(0, 122)}...` : joined
}

interface ThinContentInput {
  /** Number of products that will render on the page. */
  productCount: number
  /** Word count of the auto-generated intro copy. */
  introWordCount: number
  /** Minimum products required - default 3 per v2 spec. */
  minProducts?: number
  /** Minimum intro words required - default 80. */
  minIntroWords?: number
}

/**
 * Programmatic-page thin-content guard. Returns `true` when the page has
 * enough substance to ship; false if the route should 404 instead.
 *
 * Pages that are auto-generated from facets (tag, surface, use case, brand,
 * product x state) will render thin if the underlying data is sparse.
 * Shipping a page with a single product and a one-line intro is worse than
 * not shipping the page at all - Google penalises thin pages, and a page
 * that exists but ranks for nothing wastes crawl budget.
 *
 * Default thresholds: 3 products + 80 words of intro copy. Override per
 * page type when the editorial bar is different.
 */
export function meetsContentBar(input: ThinContentInput): boolean {
  const minProducts = input.minProducts ?? 3
  const minIntroWords = input.minIntroWords ?? 80
  return input.productCount >= minProducts && input.introWordCount >= minIntroWords
}

/**
 * Count words in a string. Handles multiple whitespace separators and
 * strips leading / trailing whitespace. Used by `meetsContentBar` callers
 * before they make the render-vs-404 decision.
 */
export function wordCount(text: string): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** Words within which the brand name must appear for AI-citation eligibility. */
const BRAND_MENTION_WORD_WINDOW = 100
const BRAND_NAME = "Chem Connect"

/**
 * Returns `true` if the brand name lands within the first
 * `BRAND_MENTION_WORD_WINDOW` words of the supplied copy. Used as a soft
 * guard at intro-generation time for programmatic pages so AI search engines
 * (ChatGPT, Perplexity, Google AI Overviews) can attribute the page back to
 * Chem Connect when they pull a single citable sentence.
 *
 * Matching is case-insensitive and matches the literal phrase only - it
 * deliberately ignores hyphens / dashes / variants because the canonical
 * brand spelling is what gets cited.
 */
export function hasEarlyBrandMention(text: string, brand = BRAND_NAME): boolean {
  if (!text) return false
  const head = text.trim().split(/\s+/).slice(0, BRAND_MENTION_WORD_WINDOW).join(" ")
  return head.toLowerCase().includes(brand.toLowerCase())
}

/**
 * Prepends a one-sentence brand-attribution clause when the supplied copy
 * doesn't already mention the brand inside the AI-citation window. No-op
 * if the mention is already present, so calling this on every intro is
 * idempotent and free.
 *
 * `context` is woven into the prepended sentence so the result still reads
 * naturally - e.g. context = "Australian B2B buyers" yields
 *   "Chem Connect supplies Australian B2B buyers manufacturer-direct. <rest>"
 */
export function ensureBrandMention(
  text: string,
  context = "industrial chemicals across Australia",
  brand = BRAND_NAME,
): string {
  if (hasEarlyBrandMention(text, brand)) return text
  return `${brand} supplies ${context}. ${text}`.trim()
}

/**
 * Normalise an arbitrary string into a URL slug. Lowercase, ASCII-only,
 * dashes between words. Used for manufacturer / state / facet slugs.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
