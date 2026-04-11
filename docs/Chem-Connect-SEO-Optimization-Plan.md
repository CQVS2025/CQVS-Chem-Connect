# Chem Connect - SEO Optimization Plan

A practical, marketplace-focused SEO roadmap for **Chem Connect**, Australia's B2B marketplace for industrial chemicals. This document outlines the on-page, technical, content, and local SEO improvements that any serious chemicals marketplace should have in place to rank, attract qualified buyers, and convert them into customers.

---

## 1. Meta Tags & Title Optimization

**Goal:** Help Google and buyers instantly understand what Chem Connect offers.

What we'll add / improve across every page (Home, Products listing, Product detail, Category, Cart, Checkout, Compliance, About, Contact):

- **Keyword-rich title tags** (55-60 chars), e.g.
  - Home: *"Chem Connect | B2B Chemical Marketplace Australia - Buy Industrial Chemicals Online"*
  - Product: *"{Product Name} - {CAS No.} | Buy in Bulk Australia | Chem Connect"*
  - Category: *"Solvents Suppliers Australia | Buy Industrial Solvents Online - Chem Connect"*
- **Unique meta descriptions** (150-160 chars) with a buyer-focused call to action ("Request a quote", "Free shipping over $X", "Trusted Australian suppliers").
- **Meta keywords** for relevant chemical names, CAS numbers, grades, and use cases.
- **Canonical URLs** on every product, category, and filter page to prevent duplicate-content issues from cart/sort/filter parameters.
- **Robots meta** - `index,follow` on public pages; `noindex` on cart, checkout, account, and admin routes.

---

## 2. Open Graph & Social Tags

**Goal:** Clean, branded previews whenever a product or page is shared on LinkedIn, WhatsApp, email, or Slack (where B2B buyers actually share links).

We'll add on every page:

- `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:site_name`
- `twitter:card` (summary_large_image), `twitter:title`, `twitter:description`, `twitter:image`
- Per-product OG images using the product photo + brand watermark.

---

## 3. Structured Data (JSON-LD Schema)

**Goal:** Unlock rich results in Google (star ratings, price, stock status, breadcrumbs, site search box).

Schemas to implement:

- **Organization** - Chem Connect name, logo, ABN, contact details, social profiles, support email/phone.
- **WebSite** - Includes `SearchAction` so Google can render a sitelinks search box for "chem connect" branded queries.
- **Product** - On every product page: name, SKU, brand, description, image, price, currency (AUD), availability, GTIN/CAS, aggregate rating, reviews.
- **Offer / AggregateOffer** - Price ranges across pack sizes (500 mL, 1 L, 5 L, 20 L, 200 L drum, IBC).
- **BreadcrumbList** - Home → Category → Sub-category → Product.
- **LocalBusiness** - Warehouse / dispatch locations across Australia (service area, opening hours, phone).
- **FAQPage** - For product Q&A, compliance, shipping, and MSDS pages.
- **Article / BlogPosting** - For the blog/knowledge-hub content (see Section 10).

---

## 4. Heading Structure & Keyword Optimization

**Goal:** Every page clearly signals its topic to search engines.

- **One H1 per page**, targeting the primary keyword:
  - Home: *"B2B Chemical Marketplace for Australian Businesses"*
  - Products: *"Buy Industrial Chemicals Online in Australia"*
  - Product detail: the full product name + grade.
- **H2 / H3** hierarchy targeting secondary keywords - e.g. *"Bulk Chemical Suppliers in Sydney / Melbourne / Brisbane / Perth"*, *"Laboratory Grade vs. Industrial Grade"*, *"Safety & Compliance (SDS, GHS, Dangerous Goods)"*.
- Natural keyword placement - no stuffing - across hero, feature blocks, and footer.

---

## 5. URL Structure & Information Architecture

**Goal:** Clean, human-readable, keyword-rich URLs that also help internal linking.

- `/products/solvents/acetone-99-5-technical-grade` ✅
- `/products?category=...&sort=...` → canonical back to the clean category URL.
- Slugs auto-generated from product name + grade + pack size where relevant.
- Category landing pages for each major chemical family (Solvents, Acids, Bases, Polymers, Surfactants, Reagents, Lab Chemicals, Cleaning Chemicals, Agrochemicals, etc.).
- Breadcrumbs on every product and category page (visible + schema).

---

## 6. Sitemap & Robots.txt

**Goal:** Make sure Google can find every product, category, and content page - and nothing it shouldn't.

- **Dynamic `sitemap.xml`** generated from the database: home, categories, all active products, blog posts, static pages. Updated automatically when products are added or removed.
- **Sitemap index** split into `products-sitemap.xml`, `categories-sitemap.xml`, `content-sitemap.xml` (marketplaces quickly exceed the 50k URL limit).
- **`robots.txt`** allowing public pages, disallowing `/cart`, `/checkout`, `/account`, `/admin`, `/api`, and linking to the sitemap.
- Submit sitemap to **Google Search Console** and **Bing Webmaster Tools**.

---

## 7. Technical SEO & Core Web Vitals

**Goal:** Fast, mobile-friendly, crawlable - Google's ranking factors.

- **Core Web Vitals**: LCP < 2.5s, INP < 200ms, CLS < 0.1. Target: green on mobile.
- **Image optimization**: Next.js `<Image>` everywhere, WebP/AVIF, lazy-loading below the fold, explicit width/height to prevent layout shift.
- **Font loading**: `next/font` with `display: swap` (already in place) - keep it that way; avoid adding blocking web fonts.
- **Preconnect / preload** hints for CDN, Supabase, and image domains.
- **HTTPS everywhere**, HTTP → HTTPS redirects, HSTS.
- **Mobile-first responsive** - buyers browse SDS and place re-orders from the field.
- **404 and 500 pages** that are helpful (search box + top categories + support link), not dead ends.
- **No broken internal links** - automated link check before each release.

---

## 8. Image & Media Optimization

- **Descriptive, keyword-rich `alt` text** on every product image - e.g. *"Acetone 99.5% technical grade, 20 L HDPE drum - Chem Connect Australia"*.
- **Image file names** should match the product (not `IMG_2938.jpg`).
- **Image sitemap** entries for product photos so they appear in Google Images (a surprisingly strong source of B2B discovery).
- **Lazy-load** non-critical images; **eager-load** the LCP image on each route.

---

## 9. Local & Australia-Specific SEO

**Goal:** Dominate Australian search intent - this is a huge moat against international chemical sites.

- **Google Business Profile** for the head office and each warehouse, fully filled in (categories, hours, photos, services, Q&A).
- **NAP consistency** (Name, Address, Phone) across the site footer, Contact page, GBP, and all Australian directories.
- **AU business directories**: Yellow Pages AU, True Local, Hotfrog, Australian Business Register, industry directories (ChemInfo, IChemE AU, etc.).
- **Location-targeted landing pages**: *"Chemical Supplier Sydney"*, *"Bulk Chemicals Melbourne"*, *"Industrial Chemicals Brisbane"*, *"Perth Chemical Distributor"* - with unique content, delivery info, and local contact.
- **Language / region tags**: `lang="en-AU"`, `hreflang="en-AU"`, currency locked to **AUD**, GST-inclusive pricing where required.
- **Dangerous Goods / freight messaging** for each state - a trust + SEO signal.

---

## 10. Content Marketing & Topical Authority

**Goal:** B2B buyers research before they buy. We want Chem Connect to be the answer at every stage.

Build a **Knowledge Hub / Blog** targeting:

- **How-to & buyer guides**: *"How to choose industrial-grade acetone"*, *"IBC vs drum - which is right for your operation?"*
- **Compliance content**: Australian **SDS (Safety Data Sheet)** library, GHS labelling, **ADG code** (Australian Dangerous Goods) basics, **SUSMP** scheduling.
- **Application pages** per industry: mining, agriculture, food & beverage, water treatment, pharma, cleaning, manufacturing, laboratory, construction.
- **CAS / product encyclopedia** - one indexable page per chemical with properties, uses, hazards, and a "Buy on Chem Connect" CTA. This is the single biggest long-tail traffic lever for a chemicals marketplace.
- **Comparison pages**: grade A vs. grade B, supplier A vs. supplier B.
- **Case studies** and customer stories (with schema).

Publishing cadence: start with 2 high-quality articles/week, scale from there.

---

## 11. Product Page SEO (the highest-ROI pages)

Every product page should include:

- Unique, non-boilerplate description (300+ words) - **never** copy the manufacturer blurb verbatim.
- **Key specs table**: CAS No., purity, grade, appearance, density, pack sizes, UN number, hazard class.
- **Pack-size / pricing matrix** (already part of the platform) with AUD pricing and stock indicators.
- **Downloadable SDS (PDF)** with a descriptive filename and anchor text.
- **Shipping & lead-time** info per state (ties into MacShip integration).
- **FAQs** (with FAQ schema): minimum order, lead time, bulk pricing, dangerous goods handling.
- **Related products** and **"Customers also bought"** - boosts internal linking + crawl depth.
- **Ratings & reviews** - essential for `AggregateRating` rich results.

---

## 12. Trust, Authority & Backlinks (Off-Page SEO)

- **Backlinks** from Australian industry bodies: RACI, IChemE AU, PACIA/Chemistry Australia, NSW EPA, local chambers of commerce.
- **Guest posts** on manufacturing, mining, and lab publications.
- **Supplier / brand pages** - each supplier gets a branded page; suppliers will naturally link back.
- **PR**: product launches, new supplier onboarding, sustainability initiatives.
- **Trust signals on-site**: ABN, compliance badges, payment logos, customer logos, testimonials, dangerous-goods licences.

---

## 13. Analytics, Tracking & Search Console

- **Google Search Console** - verified, sitemap submitted, weekly monitoring of coverage, CWV, and top queries.
- **Google Analytics 4** with e-commerce events (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`) on every product / cart / checkout action.
- **Bing Webmaster Tools** - still relevant for corporate buyers on Edge.
- **Conversion tracking** for quote requests, signups, and orders.
- **Rank tracking** for a curated list of ~100 target keywords.

---

## 14. Security, Performance & Crawl Budget

- **HTTPS + HSTS**, security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Cache & CDN** for static assets and product images.
- **Pagination** on product listings with `rel="next/prev"` semantics + canonical on filter combinations to protect crawl budget - critical once the catalog grows into the thousands.
- **Faceted navigation rules** - avoid creating infinite filter URLs in the index.

---

## 15. Accessibility (WCAG) - A Genuine SEO Win

Google increasingly rewards accessible sites, and accessibility overlaps heavily with SEO:

- Proper semantic HTML, ARIA where needed, keyboard navigation, color contrast, focus states, alt text, and form labels.
- Accessible PDFs for SDS documents where practical.

---

## Target Keywords (Starting Set)

| Priority  | Keyword examples                                                                                        |
|-----------|---------------------------------------------------------------------------------------------------------|
| Primary   | chemical marketplace Australia, buy industrial chemicals online, B2B chemical supplier Australia        |
| Secondary | bulk chemicals Australia, laboratory chemicals supplier, chemical distributor Sydney / Melbourne / Brisbane / Perth |
| Local     | chemical supplier near me, dangerous goods delivery Australia, Sydney chemical distributor              |
| Product   | buy acetone Australia, sulfuric acid supplier, sodium hydroxide bulk, isopropyl alcohol 5L              |
| Long-tail | {CAS number} supplier Australia, SDS {chemical name} Australia, {grade} {chemical} bulk price AUD       |

---

## Expected Outcomes

After the above is implemented:

- Branded search results with a clean title, description, sitelinks, and search box.
- **Rich results** on product pages: price, availability, reviews, breadcrumbs.
- Ranking for **product-level and CAS-level long-tail queries** - the main organic traffic engine for any chemicals marketplace.
- Stronger **local visibility** across Sydney, Melbourne, Brisbane, Perth, Adelaide, and regional hubs.
- Faster pages and better Core Web Vitals - lower bounce, higher conversion.
- Polished link previews on LinkedIn, WhatsApp, and email - where B2B deals actually move.
- A compounding **content + backlink flywheel** that gets stronger every month.

---

## Suggested Rollout Phases

1. **Phase 1 - Foundations (Week 1-2):** Meta tags, OG, canonical, robots, sitemap, Search Console, GA4, Core Web Vitals fixes, image alt text.
2. **Phase 2 - Structured Data & Product SEO (Week 3-4):** Product/Organization/Breadcrumb/FAQ schema, product page content, SDS downloads, reviews.
3. **Phase 3 - Local & Category SEO (Week 5-6):** City landing pages, Google Business Profile, AU directories, category hub pages.
4. **Phase 4 - Content & Authority (ongoing):** Knowledge hub, CAS encyclopedia, backlink outreach, PR.

---

*Prepared for the Chem Connect team - a living document that should be revisited each quarter as the catalog, content, and link profile grow.*
