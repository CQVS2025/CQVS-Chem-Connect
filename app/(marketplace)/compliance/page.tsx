import type { Metadata } from "next"
import Link from "next/link"
import {
  ShieldCheck,
  FileWarning,
  Truck,
  HardHat,
  Leaf,
  Scale,
  Award,
  ClipboardCheck,
  Phone,
  BadgeCheck,
  FlaskConical,
  AlertTriangle,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  title: "Chemical Compliance & Safety - SDS, DG, ADG Code",
  description:
    "Compliance information for Chem Connect by CQVS - chemical safety standards, dangerous-goods handling, ADG Code, SUSMP scheduling, customer obligations across Australia.",
  alternates: { canonical: `${SITE_URL}/compliance` },
  openGraph: {
    type: "article",
    url: `${SITE_URL}/compliance`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "Chemical Compliance & Safety · Chem Connect",
    description:
      "Chemical safety standards, dangerous-goods handling, ADG Code, SUSMP scheduling, customer obligations across Australia.",
    images: [
      {
        url: `${SITE_URL}/images/cqvs-logo.png`,
        width: 1200,
        height: 630,
        alt: "Chem Connect - Compliance & Safety",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chemical Compliance & Safety · Chem Connect",
    description:
      "Chemical safety standards, dangerous-goods handling, ADG Code, SUSMP scheduling.",
    images: [`${SITE_URL}/images/cqvs-logo.png`],
  },
}

const sections = [
  { id: "chemical-safety", label: "Chemical Safety and SDS" },
  { id: "dg-classifications", label: "Dangerous Goods Classifications" },
  { id: "transport-storage", label: "Transport and Storage Requirements" },
  { id: "ppe", label: "PPE Requirements" },
  { id: "environmental", label: "Environmental Compliance" },
  { id: "regulatory-framework", label: "Australian Regulatory Framework" },
  { id: "licensing", label: "Licensing and Certifications" },
  { id: "customer-obligations", label: "Customer Obligations" },
  { id: "emergency", label: "Emergency Contact Procedures" },
  { id: "quality-assurance", label: "Quality Assurance" },
]

export default function CompliancePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Compliance</h1>
        </div>
        <p className="text-muted-foreground">
          Last updated: March 2026
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          At Chem Connect, safety and regulatory compliance are at the core of everything we do. As a
          B2B chemical marketplace serving concrete plants, quarries, and civil construction sites
          across Australia, we are committed to meeting all applicable standards for the supply,
          transport, and handling of chemical products, including Dangerous Goods.
        </p>
      </div>

      {/* Table of Contents */}
      <Card className="mb-10">
        <CardHeader>
          <CardTitle className="text-lg">Table of Contents</CardTitle>
        </CardHeader>
        <CardContent>
          <nav>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {sections.map((section) => (
                <li key={section.id}>
                  <Link
                    href={`#${section.id}`}
                    className="text-primary hover:text-primary/80 transition-colors hover:underline"
                  >
                    {section.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-8">
        {/* 1. Chemical Safety and SDS */}
        <Card id="chemical-safety">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FlaskConical className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">1. Chemical Safety and Safety Data Sheets</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Safety Data Sheets (SDS) are the cornerstone of chemical safety management. CQVS
              provides current, GHS-compliant SDS documentation for every chemical product available
              on the Chem Connect marketplace.
            </p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">SDS Availability</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>SDS documents are available for download on each product listing page</li>
                <li>Updated SDS documents are provided with every order shipment</li>
                <li>SDS documents conform to the Globally Harmonised System (GHS) of Classification and Labelling of Chemicals, as adopted in Australia</li>
                <li>All SDS documents are maintained in the current 16-section format as required by Safe Work Australia</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">SDS Content</h4>
              <p>Each SDS includes the following key information:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Product identification and chemical composition</li>
                <li>Hazard identification and GHS classification</li>
                <li>First aid measures and firefighting procedures</li>
                <li>Accidental release measures and handling/storage guidance</li>
                <li>Exposure controls and personal protection requirements</li>
                <li>Physical and chemical properties</li>
                <li>Stability, reactivity, and toxicological information</li>
                <li>Ecological information and disposal considerations</li>
                <li>Transport information and regulatory classification</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Your Obligations</h4>
              <p>
                Under Australian Work Health and Safety (WHS) legislation, businesses that use, handle,
                or store chemical products must maintain accessible copies of current SDS documents for
                all chemicals on-site. SDS documents must be available to all workers who may be exposed
                to the chemicals and to emergency services personnel.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 2. DG Classifications */}
        <Card id="dg-classifications">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileWarning className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">2. Dangerous Goods Classifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Chem Connect supplies products across several Dangerous Goods (DG) classifications as
              defined by the Australian Dangerous Goods Code (ADG Code, Edition 7.8). Understanding
              these classifications is essential for safe handling, storage, and transport.
            </p>

            <div className="space-y-6">
              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Badge variant="destructive" className="text-sm px-3 py-1">Class 3</Badge>
                  <h4 className="font-semibold text-foreground">Flammable Liquids</h4>
                </div>
                <p>
                  Liquids with a flash point of no more than 60 degrees Celsius. This class includes
                  certain solvents, fuel additives, and specialty chemical formulations available on
                  our platform.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Storage: Flammable liquids cabinet or compliant storage area, away from ignition sources</li>
                  <li>Ventilation: Adequate ventilation required to prevent vapour accumulation</li>
                  <li>Signage: DG Class 3 diamond placard required on storage area</li>
                  <li>Segregation: Must be separated from oxidising agents (Class 5) and corrosives (Class 8)</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Badge variant="destructive" className="text-sm px-3 py-1">Class 5</Badge>
                  <h4 className="font-semibold text-foreground">Oxidising Agents</h4>
                </div>
                <p>
                  Substances that may cause or contribute to the combustion of other materials by
                  yielding oxygen. This class covers certain treatment chemicals and cleaning compounds.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Storage: Cool, dry, well-ventilated area away from combustible materials</li>
                  <li>Segregation: Must be isolated from flammable liquids (Class 3), organic materials, and reducing agents</li>
                  <li>Signage: DG Class 5 diamond placard required</li>
                  <li>Containment: Suitable bunding to contain spills</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Badge variant="destructive" className="text-sm px-3 py-1">Class 6</Badge>
                  <h4 className="font-semibold text-foreground">Toxic Substances</h4>
                </div>
                <p>
                  Substances that are liable to cause death or serious injury if swallowed, inhaled,
                  or absorbed through the skin. Includes certain industrial-grade chemicals.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Storage: Locked, secure area with restricted access; separate from food and feed</li>
                  <li>PPE: Full protective equipment as specified in the SDS</li>
                  <li>Signage: DG Class 6 diamond placard and restricted access signage required</li>
                  <li>Records: Register of toxic substances and access log must be maintained</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Badge variant="destructive" className="text-sm px-3 py-1">Class 8</Badge>
                  <h4 className="font-semibold text-foreground">Corrosives</h4>
                </div>
                <p>
                  Substances that cause destruction of living tissue and/or damage to metals on contact.
                  This is the most common DG class on our platform, covering acid replacements, surface
                  treatments, and industrial cleaning agents.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Storage: Chemically resistant bunded area; acid and alkali corrosives must be stored separately from each other</li>
                  <li>PPE: Chemical-resistant gloves, safety goggles or face shield, and protective clothing</li>
                  <li>Signage: DG Class 8 diamond placard required</li>
                  <li>Emergency equipment: Eye wash station and safety shower must be accessible within the storage area</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Transport and Storage */}
        <Card id="transport-storage">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">3. Transport and Storage Requirements</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <div>
              <h4 className="mb-2 font-semibold text-foreground">Transport Compliance</h4>
              <p>
                All dangerous goods shipments are managed through DG-licensed carriers that comply with
                the Australian Dangerous Goods Code (ADG Code) and applicable state and territory
                transport regulations. Our transport arrangements include:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>DG-rated vehicles with appropriate placarding and signage</li>
                <li>Trained and licensed drivers holding a DG driver licence where required</li>
                <li>Proper packaging, labelling, and marking per ADG Code requirements</li>
                <li>Segregation of incompatible DG classes during transport</li>
                <li>Emergency procedures documentation carried with all DG shipments</li>
                <li>Transport documentation including DG declaration and consignment notes</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Storage Requirements</h4>
              <p>
                Once products are delivered to your site, you are responsible for storage in accordance
                with the SDS and applicable Australian Standards, including:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>AS 3780 - The Storage and Handling of Corrosive Substances</li>
                <li>AS 1940 - The Storage and Handling of Flammable and Combustible Liquids</li>
                <li>AS 4326 - The Storage and Handling of Oxidising Agents</li>
                <li>State and territory Work Health and Safety Regulations for DG storage thresholds and manifest requirements</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Segregation Requirements</h4>
              <p>
                Different DG classes must be stored in compliance with segregation rules to prevent
                dangerous reactions. Key segregation requirements include:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Class 3 (Flammable Liquids) must be separated from Class 5 (Oxidising Agents)</li>
                <li>Acids and alkaline corrosives (both Class 8) must be stored separately from each other</li>
                <li>Class 6 (Toxic) substances must be stored in secure, restricted areas</li>
                <li>All DG classes must be separated from food, feed, and general merchandise</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 4. PPE Requirements */}
        <Card id="ppe">
          <CardHeader>
            <div className="flex items-center gap-3">
              <HardHat className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">4. PPE Requirements by Product Class</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Personal Protective Equipment (PPE) requirements vary by product and DG classification.
              Always refer to the specific SDS for each product for detailed PPE guidance. The
              following is a general guide:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-4 text-left font-semibold text-foreground">DG Class</th>
                    <th className="pb-3 pr-4 text-left font-semibold text-foreground">Minimum PPE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-3 pr-4 align-top">
                      <Badge variant="destructive">Class 3</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      Chemical-resistant gloves, safety glasses, anti-static clothing, respiratory
                      protection in poorly ventilated areas
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 align-top">
                      <Badge variant="destructive">Class 5</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      Chemical-resistant gloves, safety goggles, protective clothing, respiratory
                      protection if dust or fumes are generated
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 align-top">
                      <Badge variant="destructive">Class 6</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      Chemical-resistant gloves, full face shield or safety goggles, full protective
                      suit, respiratory protection (appropriate for substance type)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 align-top">
                      <Badge variant="destructive">Class 8</Badge>
                    </td>
                    <td className="py-3 pr-4">
                      Acid/alkali-resistant gloves, face shield or splash-proof goggles,
                      chemical-resistant apron or suit, rubber boots
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p>
              <strong className="text-foreground">Important:</strong> The above is a general guide only.
              Specific PPE requirements may vary by product and application. Always refer to Section 8
              of the product SDS for complete exposure controls and PPE recommendations. It is the
              employer&apos;s responsibility under WHS legislation to provide appropriate PPE and
              ensure workers are trained in its correct use.
            </p>
          </CardContent>
        </Card>

        {/* 5. Environmental Compliance */}
        <Card id="environmental">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Leaf className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">5. Environmental Compliance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              CQVS is committed to environmental responsibility. We work with suppliers and customers
              to minimise the environmental impact of chemical products throughout their lifecycle.
            </p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Spill Prevention and Response</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>All chemical storage areas must be bunded to contain spills and prevent environmental contamination</li>
                <li>Spill response equipment (absorbent materials, neutralising agents) should be readily available</li>
                <li>Significant chemical spills must be reported to the relevant state or territory environmental authority</li>
                <li>Spill response procedures must be documented and communicated to all workers</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Waste Disposal</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Chemical waste must be disposed of in accordance with Section 13 of the product SDS</li>
                <li>Waste chemicals must not be poured into drains, waterways, or onto the ground</li>
                <li>Empty containers that held DG products must be disposed of through a licensed waste contractor</li>
                <li>Records of chemical waste disposal must be maintained as required by state regulations</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Packaging and Sustainability</h4>
              <p>
                We work with suppliers to reduce packaging waste where possible while maintaining
                product integrity and DG compliance. We encourage customers to participate in
                container return programs where available and to consolidate orders to reduce
                transport emissions.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 6. Regulatory Framework */}
        <Card id="regulatory-framework">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">6. Australian Regulatory Framework</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Our operations comply with the following key Australian regulations and standards:
            </p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Work Health and Safety</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Work Health and Safety Act 2011 (Cth):</strong> Establishes the framework for
                  workplace health and safety duties, including the management of hazardous chemicals
                </li>
                <li>
                  <strong>Work Health and Safety Regulations 2011:</strong> Sets specific requirements
                  for hazardous chemical management, SDS provision, labelling, storage, and manifest
                  requirements
                </li>
                <li>
                  <strong>GHS (Globally Harmonised System):</strong> Australia has adopted the GHS for
                  classification and labelling of chemicals, which governs SDS format and hazard
                  communication
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Dangerous Goods Transport</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Australian Dangerous Goods Code (ADG Code, Edition 7.8):</strong> The national
                  code governing the transport of dangerous goods by road and rail, including
                  classification, packaging, labelling, and documentation requirements
                </li>
                <li>
                  <strong>State and Territory Transport Regulations:</strong> Each state and territory has
                  legislation adopting and implementing the ADG Code for road transport within their
                  jurisdiction
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Environmental</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Environment Protection Act (state/territory):</strong> Each jurisdiction has
                  environmental protection legislation governing chemical waste, spill reporting, and
                  pollution prevention
                </li>
                <li>
                  <strong>National Environment Protection Measures (NEPMs):</strong> National standards
                  for environmental protection that apply to chemical storage and handling
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Product Standards</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>Industrial Chemicals Act 2019 (Cth):</strong> Governs the introduction and use
                  of industrial chemicals in Australia through AICIS (Australian Industrial Chemicals
                  Introduction Scheme)
                </li>
                <li>
                  <strong>Poisons Standard (SUSMP):</strong> The Standard for the Uniform Scheduling of
                  Medicines and Poisons, which may apply to certain chemical products
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 7. Licensing */}
        <Card id="licensing">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Award className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">7. Licensing and Certifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              CQVS maintains the necessary licences and certifications to operate as a chemical
              supply platform in Australia:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Registered Australian business with a valid ABN</li>
              <li>Compliance with AICIS requirements for the supply of industrial chemicals</li>
              <li>Partnership with DG-licensed transport carriers for dangerous goods shipments</li>
              <li>Adherence to relevant Australian Standards for chemical storage and handling at our facilities</li>
            </ul>
            <p>
              We work with suppliers who maintain appropriate manufacturing certifications, quality
              management systems, and product registrations. Product compliance documentation,
              including Certificates of Analysis (COA), is available upon request.
            </p>
          </CardContent>
        </Card>

        {/* 8. Customer Obligations */}
        <Card id="customer-obligations">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">8. Customer Obligations When Ordering DG Products</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              By ordering dangerous goods products from Chem Connect, you confirm and agree to the
              following:
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>
                  <strong className="text-foreground">Competency:</strong> You have adequate knowledge
                  and training, or employ personnel with adequate knowledge and training, to safely
                  receive, handle, store, and use the DG products ordered.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>
                  <strong className="text-foreground">Facilities:</strong> You have appropriate storage
                  facilities that comply with Australian Standards and WHS Regulations for the relevant
                  DG class and quantities ordered.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>
                  <strong className="text-foreground">Licensing:</strong> You hold any licences or
                  permits required by your state or territory for the storage and handling of the DG
                  products ordered, particularly where storage quantities exceed manifest thresholds.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>
                  <strong className="text-foreground">SDS Compliance:</strong> You will obtain, read,
                  and comply with the Safety Data Sheet for every product ordered, and make it
                  available to all personnel who may come into contact with the product.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>
                  <strong className="text-foreground">PPE:</strong> You will ensure that appropriate
                  Personal Protective Equipment as specified in the SDS is available and used by all
                  personnel handling the products.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>
                  <strong className="text-foreground">Emergency Preparedness:</strong> You have
                  documented emergency procedures for chemical spills, exposure incidents, and fires
                  involving the DG products you order.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p>
                  <strong className="text-foreground">Disposal:</strong> You will dispose of chemical
                  waste and empty containers in accordance with the SDS and applicable environmental
                  regulations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 9. Emergency Contacts */}
        <Card id="emergency">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">9. Emergency Contact Procedures</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              In the event of a chemical emergency involving products purchased from Chem Connect,
              follow these procedures:
            </p>

            <div className="space-y-4">
              <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4">
                <h4 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Immediate Danger to Life
                </h4>
                <p className="text-base font-semibold text-foreground">Call Triple Zero (000)</p>
                <p className="mt-1">
                  For fire, medical emergencies, or situations involving immediate danger to life.
                  Inform emergency services of the chemicals involved, the DG class, and UN number
                  (found on the SDS and product label).
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-2 font-semibold text-foreground">Poison Information</h4>
                <p className="text-base font-semibold text-foreground">Poisons Information Centre: 13 11 26</p>
                <p className="mt-1">
                  Available 24 hours a day, 7 days a week. For advice on chemical exposure, ingestion,
                  or poisoning incidents. Have the product SDS and label available when calling.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-2 font-semibold text-foreground">Chemical Spills</h4>
                <p>
                  For significant chemical spills that may impact the environment, contact your state
                  or territory environmental authority:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>QLD - Department of Environment and Science: 1300 130 372</li>
                  <li>NSW - Environment Protection Authority: 131 555</li>
                  <li>VIC - Environment Protection Authority: 1300 372 842</li>
                  <li>SA - Environment Protection Authority: (08) 8204 2004</li>
                  <li>WA - Department of Water and Environmental Regulation: 1300 784 782</li>
                  <li>TAS - Environment Protection Authority: 1800 005 171</li>
                  <li>NT - NT Environment Protection Authority: (08) 8924 4218</li>
                  <li>ACT - Access Canberra: 13 22 81</li>
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h4 className="mb-2 font-semibold text-foreground">CQVS Product Inquiries</h4>
                <p>
                  For non-emergency product questions, SDS requests, or to report product quality
                  concerns:
                </p>
                <p className="mt-2">
                  Email:{" "}
                  <a href="mailto:support@chemconnect.com.au" className="text-primary hover:underline">
                    support@chemconnect.com.au
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 10. Quality Assurance */}
        <Card id="quality-assurance">
          <CardHeader>
            <div className="flex items-center gap-3">
              <BadgeCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">10. Quality Assurance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              CQVS is committed to supplying high-quality chemical products through the Chem Connect
              marketplace. Our quality assurance practices include:
            </p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Supplier Standards</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>We partner with suppliers who maintain quality management systems aligned with ISO 9001 standards</li>
                <li>Supplier facilities are assessed for compliance with relevant manufacturing standards</li>
                <li>Regular supplier reviews and performance monitoring</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Certificate of Analysis (COA)</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Certificates of Analysis are available for products upon request, confirming that the product meets its stated specifications</li>
                <li>COA documents include batch number, manufacturing date, test results, and specification limits</li>
                <li>Products are traceable through the supply chain via batch and lot number tracking</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Product Integrity</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Products are stored and handled in accordance with their SDS requirements throughout the supply chain</li>
                <li>Shelf life and expiry dates are monitored and managed</li>
                <li>Packaging integrity is verified before dispatch</li>
                <li>Product complaints are investigated and documented, with corrective actions implemented where necessary</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Continuous Improvement</h4>
              <p>
                We continually review and improve our compliance processes. If you identify any
                compliance concern or have suggestions for improvement, please contact us at{" "}
                <a href="mailto:support@chemconnect.com.au" className="text-primary hover:underline">
                  support@chemconnect.com.au
                </a>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <div className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          See also:{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          {" | "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Use
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">
          &copy; 2026 CQVS - Concrete & Quarry Vending Systems
        </p>
      </div>
    </div>
  )
}
