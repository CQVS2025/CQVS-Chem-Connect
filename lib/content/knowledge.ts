/**
 * Knowledge-hub article seed data.
 *
 * This is intentionally a hand-curated list rather than a CMS - the hub
 * starts with 4-8 evergreen pieces that establish topical authority, then
 * grows over time. Once the volume justifies it, swap this for a Supabase
 * `knowledge_articles` table with the same shape.
 *
 * Every article must have `author`, `publishedAt`, and `updatedAt` - these
 * are required for AI-citation eligibility (ChatGPT / Perplexity / Google
 * AI Overviews skip undated, unattributed content).
 */

export interface KnowledgeArticle {
  slug: string
  title: string
  excerpt: string
  category: "buyer-guide" | "compliance" | "comparison" | "industry"
  /** Markdown-ish body. Rendered via the article template. */
  body: string
  author: string
  publishedAt: string // ISO date
  updatedAt: string // ISO date
  tags: string[]
  /** Optional related-product slugs to link in a sidebar. */
  relatedProductSlugs?: string[]
}

export const ARTICLES: KnowledgeArticle[] = [
  {
    slug: "how-to-choose-acid-replacement-chemicals",
    title:
      "How to choose acid-replacement chemicals for your concrete plant",
    excerpt:
      "Acid replacements remove the same scale and concrete residue as hydrochloric acid with significantly less hazard, fume, and OH&S overhead. Here's how to pick the right one for your plant.",
    category: "buyer-guide",
    author: "Chem Connect Editorial",
    publishedAt: "2026-04-01",
    updatedAt: "2026-04-25",
    tags: ["acid replacement", "concrete plant", "OH&S", "buyer guide"],
    body: `## What an acid replacement actually does

Acid-replacement chemicals strip mineral scale, concrete residue, and lime build-up using a blend of organic acids (typically urea hydrochloride, gluconic acid, or citric acid) buffered to a milder pH than hydrochloric acid (HCl). For most concrete-plant cleaning duties - agi residues, plant scale, drum cleaning - they perform within 5-10% of HCl.

## When to choose acid replacement over HCl

- **OH&S risk reduction** - significantly less fume, lower skin / inhalation hazard.
- **Transport classification** - most acid replacements ship as non-DG or low-DG, vs HCl which is always DG Class 8.
- **Stainless / mild steel surfaces** - gentler on equipment, longer asset life.
- **Indoor / enclosed cleaning** - far safer in wash bays, shed cleaning.

## When HCl still wins

- Maximum aggression on heavy long-term scale.
- Where DG handling is already routine and capability is in place.
- Very high volumes where price-per-litre dominates.

## Pack sizes and economics

Acid replacements are typically priced 1.3-1.6× HCl per litre but the OH&S, freight, and equipment-life savings usually offset the difference. Standard pack sizes on Chem Connect are 5 L, 20 L, and 200 L drum, with IBC available via custom order.

## Compliance notes

All acid replacements ship with a GHS-aligned SDS. WHS storage requirements still apply - refer to the relevant state EPA guidance for bunding and ventilation in wash-bay areas.`,
    relatedProductSlugs: ["green-acid-replacement"],
  },
  {
    slug: "drum-vs-ibc-which-is-right-for-your-operation",
    title: "Drum vs IBC: which pack size is right for your operation?",
    excerpt:
      "200 L drums vs 1,000 L IBCs - pack-size choice has a bigger impact on your unit cost and OH&S profile than most buyers realise. Here's how to choose.",
    category: "buyer-guide",
    author: "Chem Connect Editorial",
    publishedAt: "2026-04-08",
    updatedAt: "2026-04-08",
    tags: ["pack size", "drums", "IBC", "freight", "buyer guide"],
    body: `## The economics

IBCs are typically 15-25% cheaper per litre than 200 L drums. The break-even point is roughly 4-5 drums per month - past that, IBC pays for itself in volume rebates and reduced handling time.

## Handling and OH&S

- **Drums** - manual handling, drum trolley required, easy to spill on tilt. Lower per-event spill volume.
- **IBCs** - forklift only, palletised, valved discharge. Higher single-spill consequence but generally fewer handling events.

## Storage footprint

Two 200 L drums (400 L total) take roughly the same floor space as a 1,000 L IBC. IBCs consolidate inventory and reduce stocktake overhead.

## Compatibility

Confirm your dosing system supports IBC discharge (valved, pumped, or gravity). Most concrete-plant chemical metering systems handle IBC natively but check the chemical's SDS for material compatibility before switching.

## When drums still win

- Small or seasonal sites under 100 L / month.
- Limited forklift access.
- Mixed product range where diversity beats volume.`,
  },
  {
    slug: "australian-sds-requirements-explained",
    title: "Australian SDS requirements explained - what every buyer should check",
    excerpt:
      "Every chemical sold in Australia must ship with a GHS-aligned Safety Data Sheet. Here's what you should verify on every SDS before accepting a delivery.",
    category: "compliance",
    author: "Chem Connect Editorial",
    publishedAt: "2026-04-15",
    updatedAt: "2026-04-15",
    tags: ["SDS", "compliance", "GHS", "WHS"],
    body: `## What an SDS must contain

Australian SDS documents follow the Globally Harmonised System (GHS) and must include 16 standardised sections, from product identification (Section 1) through to disposal (Section 13) and regulatory information (Section 15).

## What to verify on receipt

1. **Section 1 - Identification.** Product name matches the order; supplier ABN is shown.
2. **Section 2 - Hazards.** GHS pictograms and signal words match the label.
3. **Section 3 - Composition.** Active ingredients listed by CAS number with concentration ranges.
4. **Section 4 - First aid.** Specific guidance for inhalation, ingestion, skin and eye contact.
5. **Section 14 - Transport.** UN number, hazard class, packing group, and proper shipping name match the freight paperwork.

## Storage and accessibility

WHS regulations require SDS to be **immediately accessible** to workers handling the chemical. Most Australian sites maintain a hard-copy register at the chemical store plus a digital copy on a shared drive.

## When to request a fresh SDS

Manufacturers must reissue SDS within 5 years, or sooner if the formulation, hazard, or regulatory status changes. If your current SDS is older than 5 years, request a new one before next use.`,
  },
  {
    slug: "industrial-grade-vs-laboratory-grade-chemicals",
    title: "Industrial-grade vs laboratory-grade - which do you actually need?",
    excerpt:
      "Lab-grade chemicals can be 5-10× the price of industrial grade, and most of the time they're overkill. Here's how to pick the right grade for your application.",
    category: "comparison",
    author: "Chem Connect Editorial",
    publishedAt: "2026-04-22",
    updatedAt: "2026-04-22",
    tags: ["grades", "industrial", "laboratory", "comparison"],
    body: `## The grade ladder

From cheapest to most expensive: technical / industrial → reagent / lab → analytical → USP / pharma → electronic. Each step typically adds 1.5-3× to the price and tightens purity / heavy-metals limits.

## Industrial grade

Suitable for cleaning, plant maintenance, water treatment, concrete and quarry duties, and any application where the chemical is consumed or discharged. Typical purity 95-99%.

## Laboratory / reagent grade

Required for laboratory analytical work, calibration standards, and any process where minor impurities affect the result. Typical purity 99.9%+.

## Pharma / USP grade

Required only for pharmaceutical manufacturing, food contact, or human-administered products. Significantly tighter heavy-metal and microbiological limits.

## How to decide

Ask one question: **does the impurity matter for the application?** For 90% of B2B chemical purchases - cleaning, water treatment, concrete duties - industrial grade is correct. Anything stricter is overspending.`,
  },
]

export function getArticleBySlug(slug: string): KnowledgeArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug)
}

export function getArticlesByCategory(
  category: KnowledgeArticle["category"],
): KnowledgeArticle[] {
  return ARTICLES.filter((a) => a.category === category)
}

export const KNOWLEDGE_CATEGORIES: Record<
  KnowledgeArticle["category"],
  string
> = {
  "buyer-guide": "Buyer guides",
  compliance: "Compliance & safety",
  comparison: "Comparisons",
  industry: "Industry insights",
}
