/**
 * Production warehouse list - source of truth for SEO city / state pages,
 * footer NAP block, /locations hub, and LocalBusiness schemas.
 *
 * Mirrors the live `warehouses` Supabase table at the time of writing
 * (April 2026). When the live table changes, refresh this file or wire
 * the location pages to read from the API directly.
 *
 * `slug` is the URL slug used for /chemical-supplier/{slug}.
 * `state` is the AU state code matching the `regions` array on products.
 */

export interface WarehouseLocation {
  /** URL slug for /chemical-supplier/{slug}. */
  slug: string
  /** Trading name shown to users + GBP. */
  name: string | null
  /** Marketing-friendly city label (e.g. "Melbourne", "Newcastle"). */
  city: string
  /** Suburb / locality from the warehouse address. */
  suburb: string
  street: string
  postcode: string
  /** AU state code: NSW, VIC, QLD, SA, WA. */
  state: "NSW" | "VIC" | "QLD" | "SA" | "WA"
  /** Whether the warehouse currently dispatches. Inactive ones are excluded
   *  from public landing pages but kept here so we can decide what to do
   *  with their slug if reactivated. */
  active: boolean
  /** Free-text description - used in the city landing-page hero + meta. */
  description: string
  /** Coverage area (suburb / city list) shown on the city page. */
  coverage: string[]
  /** Optional GBP-style opening hours. */
  openingHours?: Array<{
    days: string[]
    opens: string
    closes: string
  }>
}

const DEFAULT_HOURS = [
  {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "08:00",
    closes: "17:00",
  },
]

export const WAREHOUSES: WarehouseLocation[] = [
  {
    slug: "melbourne",
    name: "ChemBuild Industries",
    city: "Melbourne",
    suburb: "Dandenong South",
    street: "7/9 Red Gum Dr",
    postcode: "3175",
    state: "VIC",
    active: true,
    description:
      "Melbourne dispatch hub for Chem Connect - bulk industrial chemicals, acids, alkalis, and cleaning products direct from manufacturer to concrete plants and quarries across Victoria.",
    coverage: [
      "Melbourne metro",
      "South-east Melbourne",
      "Mornington Peninsula",
      "Gippsland",
      "Western Victoria",
    ],
    openingHours: DEFAULT_HOURS,
  },
  {
    // Pattern-matched provisional name: matches the "QLD Shed" / "NSW Shed"
    // convention used elsewhere for CQVS-owned generic depots (vs partner-
    // branded sites like ChemBuild / Environex / Chemology). 14 Shorts Place
    // is a small leased commercial unit (~18 m²) per public records - a
    // satellite depot rather than a partner's branded warehouse.
    // CLIENT TODO: confirm or replace with the registered trading name -
    // GBP submission is blocked until this is locked in.
    slug: "geelong",
    name: "Geelong Shed",
    city: "Geelong",
    suburb: "Geelong",
    street: "14 Shorts Place",
    postcode: "3220",
    state: "VIC",
    active: true,
    description:
      "Geelong dispatch point for Chem Connect - bulk industrial chemicals supplied to concrete plants, quarries, and civil sites across western Victoria.",
    coverage: ["Geelong", "Bellarine Peninsula", "Surf Coast", "Western VIC"],
    openingHours: DEFAULT_HOURS,
  },
  {
    slug: "brisbane",
    name: "Environex (QLD)",
    city: "Brisbane",
    suburb: "Crestmead",
    street: "62 Platinum St",
    postcode: "4132",
    state: "QLD",
    active: true,
    description:
      "Brisbane / Logan dispatch hub for Chem Connect - manufacturer-direct industrial chemicals serving concrete plants, civil contractors, and quarries across South-East Queensland.",
    coverage: [
      "Brisbane metro",
      "Logan",
      "Ipswich",
      "Sunshine Coast",
      "Toowoomba",
    ],
    openingHours: DEFAULT_HOURS,
  },
  {
    slug: "gold-coast",
    name: "QLD Shed",
    city: "Gold Coast",
    suburb: "Burleigh Heads",
    street: "7/17 Rothcote Ct",
    postcode: "4220",
    state: "QLD",
    active: true,
    description:
      "Gold Coast dispatch point for Chem Connect - bulk industrial chemicals supplied to concrete plants, civil sites, and quarries across the Gold Coast and Northern NSW.",
    coverage: [
      "Gold Coast",
      "Northern NSW",
      "Tweed Heads",
      "Murwillumbah",
      "Hinterland",
    ],
    openingHours: DEFAULT_HOURS,
  },
  {
    slug: "adelaide",
    name: "Chemology Pty Ltd",
    city: "Adelaide",
    suburb: "Lonsdale",
    street: "4 Walla St",
    postcode: "5160",
    state: "SA",
    active: true,
    description:
      "Adelaide dispatch hub for Chem Connect - manufacturer-direct industrial chemicals supplied to concrete plants, quarries, and civil sites across South Australia.",
    coverage: [
      "Adelaide metro",
      "Fleurieu Peninsula",
      "Adelaide Hills",
      "Riverland",
      "Southern SA",
    ],
    openingHours: DEFAULT_HOURS,
  },
  {
    slug: "perth",
    name: "Environex (WA)",
    city: "Perth",
    suburb: "Wangara",
    street: "19 Motivation Dr",
    postcode: "6065",
    state: "WA",
    active: true,
    description:
      "Perth dispatch hub for Chem Connect - bulk industrial chemicals supplied to concrete plants, quarries, mining, and civil sites across Western Australia.",
    coverage: [
      "Perth metro",
      "Joondalup",
      "Mandurah",
      "Bunbury",
      "South-West WA",
    ],
    openingHours: DEFAULT_HOURS,
  },
  {
    slug: "newcastle",
    name: "NSW Shed",
    city: "Newcastle",
    suburb: "Cardiff",
    street: "24 Nelson Rd",
    postcode: "2285",
    state: "NSW",
    active: true,
    description:
      "Newcastle dispatch hub for Chem Connect - manufacturer-direct industrial chemicals supplied to concrete plants, civil sites, and quarries across the Hunter Valley, Central Coast, and Greater Sydney.",
    coverage: [
      "Newcastle",
      "Hunter Valley",
      "Central Coast",
      "Sydney metro (1-2 day delivery)",
      "Port Stephens",
    ],
    openingHours: DEFAULT_HOURS,
  },
]

/**
 * Sydney coverage page - no warehouse there, dispatched from Newcastle
 * (~140 km, 1-2 day next-day freight). Honest framing: no fake address,
 * Service schema instead of LocalBusiness.
 */
export const SYDNEY_COVERAGE = {
  slug: "sydney",
  city: "Sydney",
  state: "NSW" as const,
  description:
    "Chem Connect dispatches industrial chemicals to Sydney metro within 1-2 business days from our Newcastle hub at Cardiff. Manufacturer-direct pricing, GST-inclusive, DG-rated freight.",
  dispatchedFromSlug: "newcastle",
  coverage: [
    "Sydney CBD",
    "North Shore",
    "Inner West",
    "Western Sydney",
    "Sutherland Shire",
    "Northern Beaches",
  ],
}

export function getActiveWarehouses(): WarehouseLocation[] {
  return WAREHOUSES.filter((w) => w.active)
}

export function getWarehouseBySlug(
  slug: string,
): WarehouseLocation | undefined {
  return WAREHOUSES.find((w) => w.slug === slug && w.active)
}

export function getWarehousesByState(
  state: WarehouseLocation["state"],
): WarehouseLocation[] {
  return WAREHOUSES.filter((w) => w.state === state && w.active)
}

export const STATE_NAMES: Record<WarehouseLocation["state"], string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  SA: "South Australia",
  WA: "Western Australia",
}
