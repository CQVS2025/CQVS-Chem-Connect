/**
 * Industry / application landing-page content. One page per vertical
 * Chem Connect serves. Each entry powers /industries/{slug}.
 *
 * Buyer queries by application ("chemicals for water treatment", "mining
 * reagents Australia") rather than just by chemical name - these pages
 * exist to capture that intent and route buyers to the right products.
 */

export interface IndustryEntry {
  slug: string
  name: string
  /** Short pitch shown in the index card and SEO meta description. */
  excerpt: string
  /** Hero copy on the landing page. */
  intro: string
  /** Common use cases in this industry. */
  useCases: string[]
  /** Categories (matching lib/data/products.ts) most relevant to this industry. */
  relevantCategorySlugs: string[]
  /** Bullet-format value props for the page. */
  highlights: Array<{ title: string; body: string }>
  /** FAQs unique to this industry (FAQPage schema). */
  faqs: Array<{ question: string; answer: string }>
}

export const INDUSTRIES: IndustryEntry[] = [
  {
    slug: "concrete-and-quarrying",
    name: "Concrete & quarrying",
    excerpt:
      "Acid replacements, plant cleaners, and admix-related chemicals for concrete plants, batching sites, and quarry operations.",
    intro:
      "Chem Connect was built around the concrete and quarrying industry - it's the core CQVS customer base. Acid replacements for truck-mixer cleaning, agi-residue removal, plant scale, and quarry plant maintenance ship daily from our seven warehouses across Australia.",
    useCases: [
      "Concrete truck-mixer residue removal",
      "Agi-bowl and chute cleaning",
      "Quarry plant scale removal",
      "Batching plant degreasing",
      "Form-release agent supply",
    ],
    relevantCategorySlugs: ["acid-replacement", "acid", "cleaning"],
    highlights: [
      {
        title: "Built for daily plant cleaning",
        body: "Acid replacements stocked specifically for concrete-plant duties - gentler on stainless equipment than HCl, lower OH&S overhead.",
      },
      {
        title: "Bulk pack sizes",
        body: "20 L drums and 1,000 L IBC sizing for sites that move volume.",
      },
      {
        title: "Local dispatch",
        body: "Seven warehouses across VIC, NSW, QLD, SA, WA - closest hub ships overnight.",
      },
    ],
    faqs: [
      {
        question:
          "What's the most-ordered concrete-plant chemical on Chem Connect?",
        answer:
          "Acid-replacement truck wash and heavy-duty plant degreasers are the top categories. Many plants run a 200 L drum every 2-4 weeks depending on throughput.",
      },
      {
        question: "Do you stock admixes?",
        answer:
          "Admixes are typically supplied by the concrete producer's existing technical supplier. If you need a specific admix for a project, submit a request via Custom Orders and we'll source through our manufacturer partners.",
      },
    ],
  },
  {
    slug: "mining",
    name: "Mining",
    excerpt:
      "Reagents, dust suppressants, and process chemicals for Australian mining operations across WA, QLD, NSW, and SA.",
    intro:
      "Mining sites order high-volume process chemicals - reagents, dust suppressants, water-treatment chemicals, and equipment cleaners. Chem Connect dispatches from the closest of our seven Australian hubs to keep freight cost down on remote-site deliveries.",
    useCases: [
      "Dust suppression chemicals",
      "Water-treatment reagents",
      "Equipment degreasing",
      "Process water pH adjustment",
      "Lubricant and hydraulic fluid supply",
    ],
    relevantCategorySlugs: ["acid", "alkali", "cleaning"],
    highlights: [
      {
        title: "Remote-site freight",
        body: "DG-rated freight to mining and remote regional sites across WA, QLD, NSW, SA.",
      },
      {
        title: "Bulk and tanker volumes",
        body: "Tanker and 20,000 L+ deliveries via Custom Orders.",
      },
      {
        title: "Compliance documentation",
        body: "Full SDS pack and ADG compliance documentation with every shipment.",
      },
    ],
    faqs: [
      {
        question: "Can you ship to remote mining sites?",
        answer:
          "Yes - DG-rated freight covers all major mining regions in WA, QLD, NSW, and SA. Lead times to remote sites are typically 5-10 business days; metro-only orders are faster.",
      },
      {
        question: "Do you supply tanker volumes?",
        answer:
          "Yes. Tanker and bulk volumes (10,000 L+) are sourced via the Custom Orders process. Quotes typically returned within 1-2 business days.",
      },
    ],
  },
  {
    slug: "agriculture",
    name: "Agriculture",
    excerpt:
      "Agrochemical adjuvants, surfactants, cleaning chemicals, and dairy / livestock sanitation across Australian farms.",
    intro:
      "Agricultural operations source surfactants, adjuvants, equipment cleaners, and dairy / livestock sanitation chemicals through Chem Connect. AUD pricing, GST-inclusive, with farm-direct freight from the closest warehouse.",
    useCases: [
      "Spray adjuvants and surfactants",
      "Dairy plant CIP",
      "Livestock equipment sanitation",
      "Irrigation system cleaning",
      "Farm machinery degreasing",
    ],
    relevantCategorySlugs: ["alkali", "cleaning", "personal-care"],
    highlights: [
      {
        title: "Farm-direct freight",
        body: "Direct freight to rural depots across all five mainland states.",
      },
      {
        title: "Food / dairy grade options",
        body: "HACCP-compatible cleaners and CIP chemicals for dairy and food production.",
      },
      {
        title: "Bulk pricing for high-volume operations",
        body: "IBC and tanker pricing for high-volume farm operations.",
      },
    ],
    faqs: [
      {
        question: "Are food-grade cleaners available?",
        answer:
          "Yes. HACCP-compatible CIP cleaners are stocked with the relevant compliance documentation. Pharma / NSF-rated cleaners can be sourced via Custom Orders.",
      },
      {
        question: "Can you supply spray adjuvants?",
        answer:
          "Selected adjuvants and surfactants are stocked. For specific actives or high-volume contract supply, submit a Custom Order with the chemical name and required volume.",
      },
    ],
  },
  {
    slug: "food-and-beverage",
    name: "Food & beverage",
    excerpt:
      "CIP cleaners, sanitisers, food-grade pH adjusters, and processing aids for Australian food and beverage manufacturers.",
    intro:
      "Food and beverage manufacturers need cleaning chemicals that pass HACCP, NSF, and Australian food-safety audits. Chem Connect stocks food-grade and CIP-rated cleaners with full compliance documentation.",
    useCases: [
      "CIP (clean-in-place) systems",
      "Sanitiser and quat solutions",
      "pH adjustment in process water",
      "Boiler and cooling-tower treatment",
      "External plant sanitation",
    ],
    relevantCategorySlugs: ["alkali", "acid", "cleaning"],
    highlights: [
      {
        title: "HACCP-compatible products",
        body: "All food-grade chemicals ship with food-safety compliance documentation.",
      },
      {
        title: "CIP systems",
        body: "Caustic, acid, and sanitiser stages for full CIP cycles.",
      },
      {
        title: "AUD pricing, GST-inclusive",
        body: "Direct manufacturer pricing without distributor markup.",
      },
    ],
    faqs: [
      {
        question: "Do your CIP cleaners meet HACCP requirements?",
        answer:
          "Yes - CIP-rated cleaners on Chem Connect ship with HACCP-compatible documentation. Specific NSF-rated products are available through Custom Orders.",
      },
      {
        question: "Can I get pharma / USP-grade chemicals?",
        answer:
          "Yes - pharma / USP / BP grades are sourced via Custom Orders. Quote turnaround is typically 1-2 business days.",
      },
    ],
  },
  {
    slug: "water-treatment",
    name: "Water & wastewater treatment",
    excerpt:
      "Coagulants, flocculants, pH adjusters, disinfectants, and dosing chemicals for Australian water and wastewater operators.",
    intro:
      "Water and wastewater treatment operators source pH adjusters, coagulants, flocculants, and disinfectants from Chem Connect. Bulk IBC and tanker volumes available with full compliance documentation.",
    useCases: [
      "Drinking-water pH adjustment",
      "Wastewater coagulation",
      "Cooling-tower treatment",
      "Boiler-water dosing",
      "Process-water disinfection",
    ],
    relevantCategorySlugs: ["alkali", "acid"],
    highlights: [
      {
        title: "Bulk volumes",
        body: "IBC and tanker pricing for municipal and industrial treatment plants.",
      },
      {
        title: "Compliance documentation",
        body: "Full SDS, dosing rates, and AS/NZS compliance notes provided.",
      },
      {
        title: "Australia-wide dispatch",
        body: "Local hubs supply NSW, VIC, QLD, SA, WA municipal and industrial sites.",
      },
    ],
    faqs: [
      {
        question: "Can you supply NSF-rated drinking-water chemicals?",
        answer:
          "Yes. NSF/ANSI 60-rated drinking-water chemicals are sourced through our manufacturer partners via Custom Orders.",
      },
      {
        question: "Do you ship to remote regional water plants?",
        answer:
          "Yes. DG-rated freight covers regional Australia including remote-site water and wastewater plants.",
      },
    ],
  },
  {
    slug: "pharmaceutical-and-laboratory",
    name: "Pharmaceutical & laboratory",
    excerpt:
      "Lab-grade reagents, USP / BP / EP chemicals, and analytical-grade solvents for Australian labs and pharma manufacturers.",
    intro:
      "Laboratory and pharmaceutical operations need reagent-grade through pharma-grade chemicals with COA, lot traceability, and tight purity specs. Chem Connect's manufacturer partners supply lab and pharma grades through the Custom Orders process.",
    useCases: [
      "Analytical reagents",
      "Pharma USP / BP / EP grades",
      "Calibration standards",
      "Process intermediates",
      "Cleaning chemicals for cleanrooms",
    ],
    relevantCategorySlugs: ["acid", "alkali", "personal-care"],
    highlights: [
      {
        title: "Reagent and analytical grades",
        body: "Lab-grade chemicals with COA and lot traceability via Custom Orders.",
      },
      {
        title: "Pharma USP / BP / EP",
        body: "Sourced through certified Australian manufacturers.",
      },
      {
        title: "Cold-chain handling",
        body: "Available for temperature-sensitive products.",
      },
    ],
    faqs: [
      {
        question: "Are pharma-grade chemicals on the standard catalogue?",
        answer:
          "Pharma / USP / BP / EP-grade chemicals are sourced through Custom Orders rather than listed on the standard marketplace, due to lot-by-lot pricing variability.",
      },
      {
        question: "Do you provide COAs?",
        answer:
          "Yes - Certificates of Analysis ship with every lab- and pharma-grade order.",
      },
    ],
  },
  {
    slug: "manufacturing",
    name: "Manufacturing",
    excerpt:
      "Industrial cleaners, surface treatments, and process chemicals for Australian manufacturing operations.",
    intro:
      "Manufacturers across Australia source industrial cleaning, degreasing, and surface-treatment chemicals through Chem Connect. Standard pack sizes available immediately; custom blends and tanker volumes via Custom Orders.",
    useCases: [
      "Metal-fabrication degreasing",
      "Surface preparation",
      "Equipment maintenance",
      "Process water treatment",
      "Floor and facility cleaning",
    ],
    relevantCategorySlugs: ["cleaning", "acid", "alkali"],
    highlights: [
      {
        title: "Operational dispatch",
        body: "Same-day order from the closest hub keeps lines running.",
      },
      {
        title: "Range of grades",
        body: "Industrial through to specialty grades available.",
      },
      {
        title: "GST-inclusive",
        body: "Full tax-compliant invoices for ABN-holding manufacturers.",
      },
    ],
    faqs: [
      {
        question: "What's lead time for refill orders?",
        answer:
          "Most refill orders dispatched same-day from the closest hub and arrive within 2-4 business days metro.",
      },
      {
        question: "Can you set up account-based ordering?",
        answer:
          "Yes - NET 30 invoice accounts available on application. Email support@chemconnect.com.au with your trading details.",
      },
    ],
  },
  {
    slug: "automotive-workshops",
    name: "Automotive workshops",
    excerpt:
      "Workshop cleaners, brake-parts cleaners, AdBlue (DEF), and specialty automotive chemicals for Australian workshops and dealerships.",
    intro:
      "Automotive workshops, dealerships, and fleet operators source cleaning, degreasing, and specialty fluids through Chem Connect. AdBlue (DEF), tyre-fitting chemicals, and brake-parts cleaners stocked across all Australian hubs.",
    useCases: [
      "Workshop floor and equipment cleaning",
      "Brake-parts and engine-bay cleaning",
      "AdBlue / DEF supply",
      "Tyre-fitting bay maintenance",
      "Fleet wash-down chemicals",
    ],
    relevantCategorySlugs: ["automotive", "cleaning"],
    highlights: [
      {
        title: "AdBlue / DEF",
        body: "5 L, 10 L, 20 L, and IBC volumes - ISO 22241 compliant.",
      },
      {
        title: "Workshop-rated chemicals",
        body: "Stocked specifically for automotive workshop duties.",
      },
      {
        title: "Single-workshop friendly",
        body: "ABN required but no minimum-order threshold.",
      },
    ],
    faqs: [
      {
        question: "Is AdBlue / DEF on the marketplace?",
        answer:
          "Yes. AdBlue is stocked in 5 L, 10 L, 20 L, and IBC pack sizes - meeting ISO 22241 specification.",
      },
      {
        question: "Do you supply brake-parts cleaner?",
        answer:
          "Yes - non-chlorinated and chlorinated formulations available across all hubs.",
      },
    ],
  },
  {
    slug: "cleaning-and-sanitation",
    name: "Cleaning & sanitation",
    excerpt:
      "Industrial-strength cleaners, sanitisers, and degreasers for commercial cleaning contractors and facility-management operators.",
    intro:
      "Cleaning contractors and facility-management operators source industrial cleaners and sanitisers through Chem Connect. Bulk pricing, AUD pricing, and direct dispatch to depots across Australia.",
    useCases: [
      "Commercial floor cleaning",
      "Carpet and upholstery cleaning",
      "Toilet and washroom sanitation",
      "Kitchen and food-area sanitation",
      "External / pressure-wash chemicals",
    ],
    relevantCategorySlugs: ["cleaning", "alkali"],
    highlights: [
      {
        title: "Contract pricing",
        body: "Volume-based pricing for cleaning contractors.",
      },
      {
        title: "Range of formulations",
        body: "Acidic, alkaline, neutral, and solvent-based cleaners.",
      },
      {
        title: "Compliance docs included",
        body: "Full SDS pack with every order.",
      },
    ],
    faqs: [
      {
        question: "Can you supply industrial cleaning contractors?",
        answer:
          "Yes - most large cleaning contractors use Chem Connect for bulk supply with NET 30 accounts.",
      },
      {
        question: "Do you stock fragrance / scented cleaners?",
        answer:
          "Standard catalogue includes mainstream cleaners. Specialty scented or branded blends available via Custom Orders.",
      },
    ],
  },
  {
    slug: "construction",
    name: "Construction & civil",
    excerpt:
      "Concrete-cure additives, surface treatments, dust suppressants, and equipment cleaners for Australian construction and civil contractors.",
    intro:
      "Construction and civil contractors source concrete-cure chemicals, dust suppressants, surface treatments, and plant cleaners through Chem Connect. Direct freight to construction yards and project sites Australia-wide.",
    useCases: [
      "Concrete curing compounds",
      "Surface sealers and dust suppressants",
      "Form-release agents",
      "Plant and equipment cleaning",
      "Site dust suppression",
    ],
    relevantCategorySlugs: ["acid-replacement", "cleaning", "acid"],
    highlights: [
      {
        title: "Project-site delivery",
        body: "Direct freight to construction yards and project sites.",
      },
      {
        title: "Bulk pricing",
        body: "IBC and tanker pricing for civil-scale projects.",
      },
      {
        title: "Compliance",
        body: "ADG-compliant freight with full SDS documentation.",
      },
    ],
    faqs: [
      {
        question: "Do you deliver direct to construction sites?",
        answer:
          "Yes - direct freight to project sites with appropriate access. Confirm delivery requirements (access, forklift, off-loading) at order time.",
      },
      {
        question: "Are concrete-cure compounds stocked?",
        answer:
          "Mainstream concrete-cure compounds are stocked. Project-specific formulations available via Custom Orders.",
      },
    ],
  },
]

export function getIndustryBySlug(slug: string): IndustryEntry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug)
}
