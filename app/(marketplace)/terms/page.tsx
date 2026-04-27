import type { Metadata } from "next"
import Link from "next/link"
import {
  FileText,
  UserPlus,
  ShoppingCart,
  CreditCard,
  Truck,
  RotateCcw,
  AlertTriangle,
  Scale,
  Shield,
  Ban,
  Gavel,
  Mail,
  Package,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cqvs-chemconnect.com.au"

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Terms of Use for Chem Connect - terms governing purchases, payments, delivery, dangerous-goods handling, and use of the platform across Australia.",
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: {
    type: "article",
    url: `${SITE_URL}/terms`,
    siteName: "Chem Connect",
    locale: "en_AU",
    title: "Terms of Use · Chem Connect",
    description: "Terms governing purchases, payments, delivery and DG handling.",
  },
  twitter: {
    card: "summary",
    title: "Terms of Use · Chem Connect",
    description: "Terms governing purchases, payments, delivery and DG handling.",
  },
}

const sections = [
  { id: "acceptance", label: "Acceptance of Terms" },
  { id: "account-registration", label: "Account Registration" },
  { id: "products-pricing", label: "Product Information and Pricing" },
  { id: "ordering", label: "Ordering Process" },
  { id: "payment", label: "Payment Terms" },
  { id: "shipping", label: "Shipping and Delivery" },
  { id: "returns", label: "Returns and Refunds" },
  { id: "dangerous-goods", label: "Dangerous Goods Handling" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "liability", label: "Limitation of Liability" },
  { id: "suspension", label: "Account Suspension and Termination" },
  { id: "governing-law", label: "Governing Law" },
  { id: "contact", label: "Contact Information" },
]

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Terms of Use</h1>
        </div>
        <p className="text-muted-foreground">
          Last updated: March 2026
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          These Terms of Use govern your access to and use of the Chem Connect platform, operated by
          CQVS (Concrete & Quarry Vending Systems). By accessing or using our platform, you agree to
          be bound by these terms. If you do not agree, you must not use the platform.
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
        {/* 1. Acceptance */}
        <Card id="acceptance">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">1. Acceptance of Terms</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              By creating an account, placing an order, or otherwise using the Chem Connect platform,
              you acknowledge that you have read, understood, and agree to be bound by these Terms of
              Use, our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              , and our{" "}
              <Link href="/compliance" className="text-primary hover:underline">
                Compliance
              </Link>{" "}
              requirements.
            </p>
            <p>
              These terms constitute a legally binding agreement between your business entity and CQVS.
              The person accepting these terms represents and warrants that they have the authority to
              bind their organisation to these terms.
            </p>
            <p>
              CQVS reserves the right to modify these terms at any time. Material changes will be
              communicated to registered users via email. Continued use of the platform after changes
              are posted constitutes acceptance of the updated terms.
            </p>
          </CardContent>
        </Card>

        {/* 2. Account Registration */}
        <Card id="account-registration">
          <CardHeader>
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">2. Account Registration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Chem Connect is a business-to-business (B2B) platform. To use our services, you must:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Be a registered Australian business or an authorised representative of one</li>
              <li>Provide accurate and complete business information, including your company name and ABN</li>
              <li>Be at least 18 years of age and legally authorised to enter into commercial agreements</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update your account information if it changes</li>
            </ul>
            <p>
              CQVS reserves the right to verify your business details, including ABN validation through
              the Australian Business Register. Accounts with invalid or fraudulent business information
              may be suspended or terminated without notice.
            </p>
            <p>
              You are responsible for all activity that occurs under your account. If you suspect
              unauthorised access, you must notify us immediately at{" "}
              <a href="mailto:support@chemconnect.com.au" className="text-primary hover:underline">
                support@chemconnect.com.au
              </a>.
            </p>
          </CardContent>
        </Card>

        {/* 3. Products and Pricing */}
        <Card id="products-pricing">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">3. Product Information and Pricing</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              We make every effort to display accurate product information, descriptions, and images.
              However, we do not warrant that product descriptions, pricing, or other content on the
              platform is error-free, complete, or current.
            </p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Pricing</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>All prices are displayed in Australian Dollars (AUD)</li>
                <li>Prices are shown exclusive of GST unless otherwise stated. GST of 10% will be applied at checkout where applicable</li>
                <li>Pricing is subject to change without notice. The price at the time of order confirmation applies</li>
                <li>Bulk pricing and volume discounts may be available for qualifying orders</li>
                <li>Delivery charges are calculated separately and displayed at checkout</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Product Availability</h4>
              <p>
                Products are subject to availability. We reserve the right to limit quantities, refuse
                orders, or discontinue products at any time. If a product becomes unavailable after you
                have placed an order, we will notify you and offer a refund or alternative product.
              </p>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Safety Data Sheets</h4>
              <p>
                Safety Data Sheets (SDS) are available for all chemical products and are provided at the
                time of purchase. It is your responsibility to review the SDS before using any product
                and ensure compliance with all applicable workplace health and safety regulations.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Ordering */}
        <Card id="ordering">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">4. Ordering Process</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>The ordering process on Chem Connect works as follows:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>Browse and Select:</strong> Add products to your cart from our marketplace.
                Product quantities, pack sizes, and specifications are displayed on each product page.
              </li>
              <li>
                <strong>Review Cart:</strong> Review your selected items, quantities, and pricing in
                your shopping cart before proceeding.
              </li>
              <li>
                <strong>Checkout:</strong> Provide or confirm your delivery address, select your
                preferred payment method (card or purchase order), and review the order summary
                including GST and delivery charges.
              </li>
              <li>
                <strong>Order Confirmation:</strong> Upon successful payment or PO submission, you will
                receive an order confirmation via email with your order number, estimated delivery
                timeframe, and relevant SDS documentation.
              </li>
              <li>
                <strong>Fulfilment:</strong> Your order is processed, packed according to dangerous
                goods regulations where applicable, and dispatched to your delivery address.
              </li>
            </ol>
            <p>
              An order is not binding until we send you an order confirmation. We reserve the right to
              refuse or cancel any order at our discretion, including orders where pricing errors have
              occurred.
            </p>
          </CardContent>
        </Card>

        {/* 5. Payment */}
        <Card id="payment">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">5. Payment Terms</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>Chem Connect accepts the following payment methods:</p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Card Payment (via Stripe)</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Payment is processed immediately at the time of checkout</li>
                <li>We accept Visa, Mastercard, and American Express</li>
                <li>All card transactions are processed securely through Stripe</li>
                <li>A tax invoice is generated automatically upon successful payment</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Purchase Order (PO)</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Available to approved business accounts only</li>
                <li>Payment terms are net 30 days from the date of invoice</li>
                <li>A valid purchase order number must be provided at checkout</li>
                <li>CQVS reserves the right to approve or decline PO payment on a per-order or per-account basis</li>
                <li>Late payments may incur interest charges and may result in suspension of PO privileges</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">GST</h4>
              <p>
                CQVS is registered for GST. All prices are displayed exclusive of GST unless otherwise
                indicated. A GST component of 10% is added at checkout. Tax invoices compliant with ATO
                requirements are provided for all transactions.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 6. Shipping */}
        <Card id="shipping">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">6. Shipping and Delivery</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <div>
              <h4 className="mb-2 font-semibold text-foreground">Delivery Areas</h4>
              <p>
                We deliver to business addresses and work sites across Australia. Delivery availability
                and timeframes may vary by region, particularly for remote or regional locations.
              </p>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Estimated Timeframes</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Metropolitan areas: 3-5 business days from order confirmation</li>
                <li>Regional areas: 5-10 business days from order confirmation</li>
                <li>Remote areas: 10-15 business days from order confirmation</li>
              </ul>
              <p className="mt-2">
                These are estimates only. Actual delivery times may vary due to stock availability,
                carrier schedules, weather conditions, or other factors outside our control.
              </p>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Dangerous Goods Transport</h4>
              <p>
                Products classified as Dangerous Goods are transported by DG-rated carriers in compliance
                with the Australian Dangerous Goods Code (ADG Code) and relevant state and territory
                transport regulations. DG shipments may have longer lead times and additional freight
                charges due to specialised handling requirements.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="destructive">DG Class 3 - Flammable Liquids</Badge>
                <Badge variant="destructive">DG Class 5 - Oxidising Agents</Badge>
                <Badge variant="destructive">DG Class 6 - Toxic Substances</Badge>
                <Badge variant="destructive">DG Class 8 - Corrosives</Badge>
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Delivery Acceptance</h4>
              <p>
                An authorised representative must be present to receive deliveries, particularly for
                dangerous goods. You must inspect the goods upon delivery and report any damage or
                discrepancies within 48 hours of receipt. Failure to report issues within this period
                may affect your ability to claim for damaged goods.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 7. Returns */}
        <Card id="returns">
          <CardHeader>
            <div className="flex items-center gap-3">
              <RotateCcw className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">7. Returns and Refunds</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Due to the nature of chemical products and strict safety regulations, our returns policy
              is more limited than standard retail. Please review the following carefully:
            </p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Accepted Returns</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Products received in a damaged condition (reported within 48 hours of delivery with photographic evidence)</li>
                <li>Incorrect products shipped (wrong product, wrong quantity)</li>
                <li>Products that do not meet the specifications stated in the product listing or Certificate of Analysis (COA)</li>
                <li>Defective or contaminated products</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Not Accepted for Return</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Products that have been opened, used, or had their seal broken (unless defective)</li>
                <li>Products where the original packaging or labelling has been altered or removed</li>
                <li>Products that have been stored improperly after delivery (not in accordance with SDS requirements)</li>
                <li>Custom or specially ordered products</li>
                <li>Change-of-mind returns for chemical products</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Refund Process</h4>
              <p>
                Approved refunds will be processed within 10 business days using the original payment
                method. For card payments, refunds are processed back to the original card via Stripe.
                For PO payments, a credit note will be issued against the original invoice.
              </p>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Australian Consumer Law</h4>
              <p>
                Nothing in this returns policy limits your rights under the Australian Consumer Law.
                Goods come with guarantees that cannot be excluded under Australian Consumer Law,
                including the guarantee that goods are of acceptable quality and fit for purpose.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 8. Dangerous Goods */}
        <Card id="dangerous-goods">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">8. Dangerous Goods Handling</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Many products available on Chem Connect are classified as Dangerous Goods under the
              Australian Dangerous Goods Code (ADG Code). By purchasing these products, you acknowledge
              and agree to the following:
            </p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Customer Responsibilities</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>You must review and comply with the Safety Data Sheet (SDS) for every product you purchase</li>
                <li>You must have appropriate storage facilities that comply with Australian Standards for the relevant DG class</li>
                <li>You must ensure staff handling DG products have received appropriate training</li>
                <li>You must maintain appropriate Personal Protective Equipment (PPE) as specified in the SDS</li>
                <li>You must comply with all applicable federal, state, and territory regulations regarding the storage, handling, and use of dangerous goods</li>
                <li>You must maintain a current dangerous goods manifest for your site if required by regulations</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">DG Classifications We Handle</h4>
              <div className="mt-2 space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="destructive" className="mt-0.5 shrink-0">Class 3</Badge>
                  <p>Flammable Liquids - Includes certain solvents and fuel additives. Requires ventilated storage away from ignition sources.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="destructive" className="mt-0.5 shrink-0">Class 5</Badge>
                  <p>Oxidising Agents - Includes certain cleaning and treatment chemicals. Must be stored separately from flammable materials.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="destructive" className="mt-0.5 shrink-0">Class 6</Badge>
                  <p>Toxic Substances - Includes certain industrial chemicals. Requires secure storage with restricted access.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Badge variant="destructive" className="mt-0.5 shrink-0">Class 8</Badge>
                  <p>Corrosives - Includes acid replacements and certain cleaning agents. Requires chemically resistant containment and storage.</p>
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">SDS Compliance</h4>
              <p>
                Safety Data Sheets are provided with all chemical product orders and are available for
                download from the product page. It is your legal obligation to ensure SDS documents are
                readily accessible to all personnel who may come into contact with the products. SDS
                documents must be kept on-site and up to date in accordance with the Work Health and
                Safety Regulations.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 9. Intellectual Property */}
        <Card id="intellectual-property">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">9. Intellectual Property</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              All content on the Chem Connect platform, including but not limited to text, graphics,
              logos, images, software, and the design and layout of the platform, is the property of
              CQVS or its licensors and is protected by Australian and international intellectual
              property laws.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>You may not reproduce, modify, distribute, or commercially exploit any platform content without our prior written consent</li>
              <li>The Chem Connect and CQVS names, logos, and branding are trademarks of CQVS and may not be used without permission</li>
              <li>Product names and brands displayed on the platform are trademarks of their respective owners</li>
              <li>SDS documents and product technical data are provided for informational purposes only in connection with your purchase and use of the products</li>
            </ul>
          </CardContent>
        </Card>

        {/* 10. Liability */}
        <Card id="liability">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">10. Limitation of Liability</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>To the maximum extent permitted by Australian law:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                CQVS provides the Chem Connect platform on an "as is" and "as available" basis. We do
                not guarantee uninterrupted, error-free, or secure access to the platform.
              </li>
              <li>
                Our total liability for any claim arising from your use of the platform or our products
                is limited to the amount you paid for the specific product or service giving rise to the claim.
              </li>
              <li>
                CQVS is not liable for any indirect, incidental, consequential, or punitive damages,
                including but not limited to loss of profits, data, or business opportunities.
              </li>
              <li>
                CQVS is not responsible for any loss, damage, or injury arising from the improper
                storage, handling, or use of chemical products in violation of the SDS or applicable
                regulations.
              </li>
              <li>
                CQVS is not liable for delays or failures in delivery caused by circumstances beyond
                our reasonable control, including natural disasters, strikes, transport disruptions, or
                government actions.
              </li>
            </ul>
            <p>
              Nothing in these terms excludes, restricts, or modifies any consumer guarantee, right, or
              remedy conferred by the Australian Consumer Law or any other applicable law that cannot be
              excluded, restricted, or modified by agreement.
            </p>
          </CardContent>
        </Card>

        {/* 11. Suspension */}
        <Card id="suspension">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Ban className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">11. Account Suspension and Termination</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>CQVS may suspend or terminate your account if:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>You breach any provision of these Terms of Use</li>
              <li>Your business information is found to be inaccurate or fraudulent</li>
              <li>Payment is not received within the agreed terms (including overdue PO payments)</li>
              <li>You engage in conduct that is harmful to CQVS, other users, or the platform</li>
              <li>We are required to do so by law or regulatory order</li>
              <li>Your account shows signs of unauthorised access or security compromise</li>
            </ul>
            <p>
              Where possible, we will provide notice before suspending or terminating your account
              and give you an opportunity to remedy the issue. However, we reserve the right to take
              immediate action where we deem it necessary to protect the platform, other users, or
              comply with legal requirements.
            </p>
            <p>
              You may close your account at any time by contacting us. Account closure does not release
              you from any outstanding payment obligations or ongoing responsibilities related to
              products already purchased.
            </p>
          </CardContent>
        </Card>

        {/* 12. Governing Law */}
        <Card id="governing-law">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Gavel className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">12. Governing Law</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              These Terms of Use are governed by and construed in accordance with the laws of the
              State of Queensland, Australia, and the Commonwealth of Australia.
            </p>
            <p>
              Any dispute arising out of or in connection with these terms shall be subject to the
              exclusive jurisdiction of the courts of Queensland, Australia. Before commencing legal
              proceedings, the parties agree to attempt to resolve disputes through good-faith
              negotiation and, if necessary, mediation.
            </p>
            <p>
              If any provision of these terms is found to be invalid, illegal, or unenforceable by a
              court of competent jurisdiction, the remaining provisions will continue in full force and
              effect.
            </p>
          </CardContent>
        </Card>

        {/* 13. Contact */}
        <Card id="contact">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">13. Contact Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              If you have any questions about these Terms of Use or need assistance with your account,
              please contact us:
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-semibold text-foreground">CQVS - Concrete & Quarry Vending Systems</p>
              <p className="mt-1">Chem Connect Support Team</p>
              <p className="mt-2">
                Email:{" "}
                <a href="mailto:support@chemconnect.com.au" className="text-primary hover:underline">
                  support@chemconnect.com.au
                </a>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                For urgent matters relating to dangerous goods or product safety, please contact us
                immediately. For general inquiries, we aim to respond within 1-2 business days.
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
          <Link href="/compliance" className="text-primary hover:underline">
            Compliance
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">
          &copy; 2026 CQVS - Concrete & Quarry Vending Systems
        </p>
      </div>
    </div>
  )
}
