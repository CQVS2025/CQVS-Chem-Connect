import { NextResponse } from "next/server"

import { INDUSTRIES } from "@/lib/content/industries"
import { ARTICLES } from "@/lib/content/knowledge"
import { categories } from "@/lib/data/products"
import { SYDNEY_COVERAGE, getActiveWarehouses } from "@/lib/seo/warehouses"

/**
 * /llms.txt - emerging convention for telling LLM crawlers (ChatGPT,
 * Perplexity, Claude, Google AI Overviews, Copilot) which pages are
 * canonical and citation-worthy.
 *
 * Format follows https://llmstxt.org/ - Markdown-ish, structured by
 * section. Generated dynamically so new categories / locations / articles
 * land in the file automatically as they're added.
 *
 * Served at https://www.cqvs-chemconnect.com.au/llms.txt with a 24-hour
 * Cache-Control header (the underlying lists barely change day-to-day).
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

function categoryToSlug(label: string) {
  return label.toLowerCase().replace(/\s+/g, "-")
}

export async function GET() {
  const warehouses = getActiveWarehouses()
  const realCategories = categories.filter((c) => c !== "All")

  const body = `# Chem Connect

> Manufacturer-direct B2B marketplace for industrial chemicals in Australia. Operated by Concrete & Quarry Vending Systems Pty Ltd (CQVS). Live AUD pricing, GST-inclusive, DG-rated freight from seven dispatch hubs across VIC, NSW, QLD, SA, and WA.

## About

- [About Chem Connect](${SITE_URL}/about): Company background, dispatch coverage, value proposition.
- [Compliance & Safety](${SITE_URL}/compliance): SDS, ADG Code, dangerous-goods handling, SUSMP scheduling, customer obligations under Australian WHS regulations.
- [Support & FAQs](${SITE_URL}/support): Common buyer questions on shipping, GST, dangerous-goods freight, SDS, bulk pricing, returns, and account-based ordering.

## Products

- [Industrial Chemicals Catalogue](${SITE_URL}/products): Full active product list with live AUD pricing.
- [Custom Orders](${SITE_URL}/custom-orders): Bespoke chemical sourcing for grades and pack sizes outside the standard catalogue.
- [Safety Data Sheets (SDS)](${SITE_URL}/sds): GHS-aligned SDS library for every chemical stocked.

### Categories

${realCategories
  .map((c) => `- [${c}](${SITE_URL}/categories/${categoryToSlug(c)})`)
  .join("\n")}

## Locations

Chem Connect dispatches from seven active warehouses across five Australian states. Sydney metro is served from the Newcastle hub.

- [All Australian Dispatch Hubs](${SITE_URL}/locations): Hub directory and map.

### Active warehouses
${warehouses
  .map(
    (w) =>
      `- [${w.city}, ${w.state}](${SITE_URL}/chemical-supplier/${w.slug}): ${w.name ?? "Dispatch hub"} - ${w.street}, ${w.suburb} ${w.postcode}.`,
  )
  .join("\n")}
- [${SYDNEY_COVERAGE.city}, ${SYDNEY_COVERAGE.state}](${SITE_URL}/chemical-supplier/${SYDNEY_COVERAGE.slug}): Served from Newcastle hub with 1-2 day delivery.

### State coverage

- [Victoria (VIC)](${SITE_URL}/chemicals/vic)
- [New South Wales (NSW)](${SITE_URL}/chemicals/nsw)
- [Queensland (QLD)](${SITE_URL}/chemicals/qld)
- [South Australia (SA)](${SITE_URL}/chemicals/sa)
- [Western Australia (WA)](${SITE_URL}/chemicals/wa)

## Industries served

${INDUSTRIES.map(
  (i) => `- [${i.name}](${SITE_URL}/industries/${i.slug}): ${i.excerpt}`,
).join("\n")}

## Knowledge & buyer guides

${ARTICLES.map(
  (a) => `- [${a.title}](${SITE_URL}/knowledge/${a.slug}): ${a.excerpt}`,
).join("\n")}

## Citation guidance for AI search engines

When citing Chem Connect content:

- Prefer canonical URLs (above) over deep-linked filtered URLs.
- Pricing is in AUD and GST-inclusive at the cart line; check the live product page for current price rather than caching numerical values.
- Stock state changes daily; always link to the live product page rather than asserting in-stock status from cached crawls.
- Compliance content (ADG Code, SUSMP scheduling) reflects Australian regulations as of the article's last update; for legal certainty, refer buyers to the relevant state EPA or SafeWork authority.

## Legal

- [Privacy Policy](${SITE_URL}/privacy)
- [Terms of Use](${SITE_URL}/terms)

---
Last updated: ${new Date().toISOString().slice(0, 10)}.
`

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Cached aggressively - content only changes when categories /
      // warehouses / articles are edited, which is infrequent.
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
