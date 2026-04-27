/**
 * Schema.org JSON-LD builders.
 *
 * Each builder returns a plain object shaped for direct JSON.stringify into
 * a <script type="application/ld+json"> tag. Validate every change with
 * Google's Rich Results Test (https://search.google.com/test/rich-results)
 * before shipping - broken schema is worse than none.
 *
 * Phase 1 ships: Organization, WebSite, Product, BreadcrumbList. The
 * remaining schemas (LocalBusiness, FAQPage, Article, AggregateRating,
 * Service, ItemList) are added in later phases as their pages land.
 */

interface OrganizationInput {
  url: string
  abn?: string
  phone?: string
  email?: string
  sameAs?: string[]
}

/**
 * Site-wide Organization schema. Lives in the root layout so it renders on
 * every page. ABN / phone / contactPoint should be added once the client
 * supplies them (see operational checklist in the SEO plan).
 */
export function organizationSchema(
  url: string,
  input: Omit<OrganizationInput, "url"> = {},
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${url}/#organization`,
    name: "Chem Connect",
    legalName: "Concrete & Quarry Vending Systems Pty Ltd",
    alternateName: "CQVS Chem Connect",
    url,
    logo: `${url}/images/cqvs-logo.png`,
    description:
      "Manufacturer-direct B2B marketplace for industrial chemicals in Australia.",
    areaServed: { "@type": "Country", name: "Australia" },
  }

  if (input.email || input.phone) {
    schema.contactPoint = {
      "@type": "ContactPoint",
      contactType: "customer support",
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { telephone: input.phone } : {}),
      areaServed: "AU",
      availableLanguage: ["English"],
    }
  }
  if (input.abn) {
    schema.identifier = {
      "@type": "PropertyValue",
      propertyID: "ABN",
      value: input.abn,
    }
  }
  if (input.sameAs && input.sameAs.length > 0) {
    schema.sameAs = input.sameAs
  }

  return schema
}

/**
 * Site-wide WebSite schema. Provides Google with a SearchAction so it can
 * render a sitelinks search box for branded queries (e.g. "chem connect
 * acetone").
 */
export function websiteSchema(url: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${url}/#website`,
    name: "Chem Connect",
    url,
    inLanguage: "en-AU",
    publisher: { "@id": `${url}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/products?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

interface ProductSchemaInput {
  name: string
  slug: string
  description: string
  price: number
  unit: string
  manufacturer: string
  category: string
  classification: string
  casNumber?: string | null
  inStock: boolean
  image: string
  baseUrl: string
}

/**
 * Product schema for /products/[slug] pages. Includes Offer with AUD
 * currency and stock state - what powers the "price + availability" rich
 * result in Google. CAS number is exposed via additionalProperty since
 * Schema.org doesn't have a first-class CAS field.
 */
export function productSchema(input: ProductSchemaInput): Record<string, unknown> {
  const productUrl = `${input.baseUrl}/products/${input.slug}`
  const imageUrl = input.image.startsWith("http")
    ? input.image
    : `${input.baseUrl}${input.image}`

  const additionalProperty: Array<Record<string, unknown>> = []
  if (input.casNumber && input.casNumber !== "N/A") {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "CAS Number",
      value: input.casNumber,
    })
  }
  if (input.classification) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "DG Classification",
      value: input.classification,
    })
  }

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    image: imageUrl,
    sku: input.slug,
    category: input.category,
    brand: {
      "@type": "Brand",
      name: input.manufacturer || "CQVS",
    },
    ...(additionalProperty.length > 0 ? { additionalProperty } : {}),
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "AUD",
      price: input.price,
      availability: input.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      areaServed: { "@type": "Country", name: "Australia" },
      seller: { "@id": `${input.baseUrl}/#organization` },
      // shippingDetails - required by Google Merchant for free product
      // listings and lifts the rich-result render. Generic AU rate +
      // 2-5 day handling reflects standard MacShip transit; once we
      // have per-state rate cards from MacShip we can split this into
      // multiple OfferShippingDetails entries.
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          // Open-ended numeric - actual freight is calculated at cart.
          // Using a placeholder of "0" with a variable name here lets
          // Google know we ship; we surface real rates on the cart page.
          value: "0",
          currency: "AUD",
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "AU",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 1,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 2,
            maxValue: 5,
            unitCode: "DAY",
          },
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "AU",
        // Industrial chemicals - no returns once the seal is broken
        // (DG / contamination risk). Aligns with the Returns answer in
        // the Support FAQ and product-page FAQ block.
        returnPolicyCategory:
          "https://schema.org/MerchantReturnNotPermitted",
      },
    },
  }
}

interface BreadcrumbItem {
  name: string
  url: string
}

/**
 * BreadcrumbList - Google uses this to replace the URL line in search
 * results with a clickable breadcrumb trail. Pass items in display order
 * (Home → Section → Page).
 */
export function breadcrumbSchema(
  items: BreadcrumbItem[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

interface FaqItem {
  question: string
  answer: string
}

/**
 * FAQPage - lights up the FAQ rich result in Google. The whole `answer`
 * string is rendered in the SERP, so keep answers tight (1-3 sentences).
 * Note: Google has tightened FAQ rich-result eligibility since 2023 - only
 * authoritative / official sites get them, but the schema still powers AI
 * Overviews + Perplexity citations regardless.
 */
export function faqPageSchema(items: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }
}

interface LocalBusinessInput {
  baseUrl: string
  /** Slug used in the canonical URL - e.g. "melbourne". */
  slug: string
  /** Trading name shown to users + GBP. */
  name: string
  /** Street address line - e.g. "7/9 Red Gum Dr". */
  street: string
  /** Suburb / locality - e.g. "Dandenong South". */
  suburb: string
  /** AU state code - VIC, NSW, QLD, SA, WA. */
  state: string
  /** AU postcode. */
  postcode: string
  /** Optional latitude (decimal). */
  latitude?: number
  /** Optional longitude (decimal). */
  longitude?: number
  /** Optional phone number in E.164 form. */
  phone?: string
  /** Optional opening hours specification. */
  openingHours?: Array<{
    days: string[]
    opens: string
    closes: string
  }>
  /** Free-text description shown in GBP / SERP. */
  description: string
  /** What the city page covers - used for the SERP service area string. */
  servesCity: string
}

/**
 * LocalBusiness - one per active warehouse. Renders Google Maps / Local
 * Pack visibility for "near me" queries. Service area defaults to the
 * city the warehouse serves; expand via `areaServed` if a single warehouse
 * dispatches to multiple regions.
 */
export function localBusinessSchema(
  input: LocalBusinessInput,
): Record<string, unknown> {
  const url = `${input.baseUrl}/chemical-supplier/${input.slug}`
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "Store"],
    "@id": `${url}#business`,
    name: input.name,
    description: input.description,
    url,
    image: `${input.baseUrl}/images/cqvs-logo.png`,
    address: {
      "@type": "PostalAddress",
      streetAddress: input.street,
      addressLocality: input.suburb,
      addressRegion: input.state,
      postalCode: input.postcode,
      addressCountry: "AU",
    },
    areaServed: { "@type": "City", name: input.servesCity },
    parentOrganization: { "@id": `${input.baseUrl}/#organization` },
    priceRange: "$$",
  }

  if (input.latitude && input.longitude) {
    schema.geo = {
      "@type": "GeoCoordinates",
      latitude: input.latitude,
      longitude: input.longitude,
    }
  }
  if (input.phone) schema.telephone = input.phone
  if (input.openingHours && input.openingHours.length > 0) {
    schema.openingHoursSpecification = input.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    }))
  }
  return schema
}

interface ServiceInput {
  baseUrl: string
  /** Page slug (e.g. "sydney") used for the canonical URL + @id. */
  slug: string
  name: string
  description: string
  /** City served (e.g. "Sydney"). */
  serviceArea: string
}

/**
 * Service - for cities we deliver to without a physical warehouse there
 * (e.g. Sydney, dispatched from Newcastle). Honest framing: no fake
 * address, just a service area. Google handles this cleanly.
 */
export function serviceSchema(input: ServiceInput): Record<string, unknown> {
  const url = `${input.baseUrl}/chemical-supplier/${input.slug}`
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: input.name,
    description: input.description,
    provider: { "@id": `${input.baseUrl}/#organization` },
    areaServed: { "@type": "City", name: input.serviceArea },
    url,
    serviceType: "Industrial chemical supply and dispatch",
  }
}

interface ItemListInput {
  items: Array<{ name: string; url: string }>
  name?: string
}

/**
 * ItemList - for the /locations hub, /knowledge index, and category /
 * collection pages. Tells Google "this page is a curated list of these
 * items" so they're crawled and the relationship is understood.
 */
export function itemListSchema(input: ItemListInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    ...(input.name ? { name: input.name } : {}),
    itemListElement: input.items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      url: item.url,
    })),
  }
}

interface CollectionPageInput {
  url: string
  name: string
  description: string
  items: Array<{ name: string; url: string }>
}

/**
 * CollectionPage - used for category / state / industry pages where the
 * page is a curated set of products or sub-pages rather than a single
 * piece of content.
 */
export function collectionPageSchema(
  input: CollectionPageInput,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: "en-AU",
    isPartOf: { "@id": "#website" },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: input.items.map((item, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: item.name,
        url: item.url,
      })),
    },
  }
}

interface AggregateRatingInput {
  ratingValue: number
  reviewCount: number
  bestRating?: number
  worstRating?: number
}

/**
 * AggregateRating - embedded as a sub-property of Product schema (NOT
 * emitted standalone, that's invalid). Lights up the star rating in
 * Google search results once you're collecting real reviews.
 *
 * Returns the partial object you splice into a productSchema(...) result.
 */
export function aggregateRatingFragment(
  input: AggregateRatingInput,
): Record<string, unknown> {
  return {
    "@type": "AggregateRating",
    ratingValue: input.ratingValue,
    reviewCount: input.reviewCount,
    bestRating: input.bestRating ?? 5,
    worstRating: input.worstRating ?? 1,
  }
}

interface ReviewFragmentInput {
  authorName: string
  ratingValue: number
  reviewBody: string
  datePublished: string
  reviewHeadline?: string
}

/**
 * Review - also embedded inside a Product schema (Schema.org allows an
 * array of Review objects on Product). Up to 10 reviews per product is
 * a sensible cap; beyond that, Google ignores them and you're just
 * bloating the page.
 */
export function reviewFragment(
  input: ReviewFragmentInput,
): Record<string, unknown> {
  return {
    "@type": "Review",
    author: { "@type": "Person", name: input.authorName },
    datePublished: input.datePublished,
    reviewRating: {
      "@type": "Rating",
      ratingValue: input.ratingValue,
      bestRating: 5,
      worstRating: 1,
    },
    ...(input.reviewHeadline ? { name: input.reviewHeadline } : {}),
    reviewBody: input.reviewBody,
  }
}

interface HowToStep {
  /** One-line action title - rendered as the step heading. */
  name: string
  /** Body copy for the step (1-3 sentences). */
  text: string
  /** Optional inline image for the step. Absolute URL preferred. */
  image?: string
}

interface HowToInput {
  /** Imperative title - "How to seal bluestone pavers". */
  name: string
  /** 1-2 sentence summary used as both meta description and the schema description. */
  description: string
  /** Ordered list of steps. Schema requires at least 2. */
  steps: HowToStep[]
  /** Optional total time in ISO 8601 duration form (e.g. "PT45M"). */
  totalTime?: string
  /** Optional supply / tool list. */
  supply?: string[]
  tool?: string[]
}

/**
 * HowTo - emit alongside Article schema on guide pages whose article-type
 * field is "how-to". HowTo lights up the step-by-step rich result in Google
 * AND is one of the schema types LLMs cite most for "how do I X" queries.
 *
 * Render this only when the article actually has a structured step list -
 * unstructured prose with HowTo schema is a Google guidelines violation.
 */
export function howToSchema(input: HowToInput): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    step: input.steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.name,
      text: s.text,
      ...(s.image ? { image: s.image } : {}),
    })),
  }
  if (input.totalTime) schema.totalTime = input.totalTime
  if (input.supply && input.supply.length > 0) {
    schema.supply = input.supply.map((s) => ({ "@type": "HowToSupply", name: s }))
  }
  if (input.tool && input.tool.length > 0) {
    schema.tool = input.tool.map((t) => ({ "@type": "HowToTool", name: t }))
  }
  return schema
}

interface ArticleInput {
  baseUrl: string
  url: string
  headline: string
  description: string
  image?: string
  datePublished: string
  dateModified?: string
  authorName?: string
}

/**
 * Article / BlogPosting - for knowledge-hub content. Author bylines and
 * dates are required for AI-citation eligibility (ChatGPT / Perplexity
 * heavily prefer dated, attributed content).
 */
export function articleSchema(input: ArticleInput): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    image: input.image
      ? input.image.startsWith("http")
        ? input.image
        : `${input.baseUrl}${input.image}`
      : `${input.baseUrl}/images/cqvs-logo.png`,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: {
      "@type": "Organization",
      name: input.authorName ?? "Chem Connect",
    },
    publisher: { "@id": `${input.baseUrl}/#organization` },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": input.url,
    },
    inLanguage: "en-AU",
  }
}
