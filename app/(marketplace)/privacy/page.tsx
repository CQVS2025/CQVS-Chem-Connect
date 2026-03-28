import type { Metadata } from "next"
import Link from "next/link"
import { Shield, Database, Cookie, Lock, UserCheck, Mail, Eye, Clock, Scale } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Privacy Policy - Chem Connect by CQVS",
  description:
    "Privacy Policy for Chem Connect, the B2B chemical marketplace by CQVS. Learn how we collect, use, and protect your business information under the Australian Privacy Act 1988.",
}

const sections = [
  { id: "information-collection", label: "Information We Collect" },
  { id: "how-we-use", label: "How We Use Your Information" },
  { id: "information-sharing", label: "Information Sharing" },
  { id: "data-security", label: "Data Security" },
  { id: "cookies", label: "Cookie Policy" },
  { id: "australian-privacy", label: "Australian Privacy Act Compliance" },
  { id: "data-retention", label: "Data Retention" },
  { id: "your-rights", label: "Your Rights" },
  { id: "childrens-privacy", label: "Children's Privacy" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact Us" },
]

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        </div>
        <p className="text-muted-foreground">
          Last updated: March 2026
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Chem Connect is operated by CQVS (Concrete & Quarry Vending Systems). We are committed to
          protecting the privacy of our business customers and partners. This Privacy Policy explains
          how we collect, use, disclose, and safeguard your information when you use our B2B chemical
          marketplace platform.
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
        {/* 1. Information Collection */}
        <Card id="information-collection">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">1. Information We Collect</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>We collect information necessary to operate our B2B chemical marketplace and provide services to your business. This includes:</p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Account and Business Information</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Company name, ABN (Australian Business Number), and business registration details</li>
                <li>Contact name, email address, phone number, and job title</li>
                <li>Business address, delivery address, and site locations</li>
                <li>Company logo and branding materials you choose to upload</li>
                <li>Industry type (e.g., concrete plant, quarry, civil construction)</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Payment Information</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Credit or debit card details (processed securely via Stripe - we do not store full card numbers)</li>
                <li>Purchase order references and billing information</li>
                <li>Transaction history and invoice records</li>
                <li>GST registration status</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Usage Data</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Pages viewed, products browsed, and search queries</li>
                <li>Order history and purchasing patterns</li>
                <li>Device information, browser type, and IP address</li>
                <li>Access times and referring URLs</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Communication Data</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Customer support inquiries and correspondence</li>
                <li>Feedback, reviews, and survey responses</li>
                <li>Communication preferences and marketing opt-in/out choices</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 2. How We Use Information */}
        <Card id="how-we-use">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">2. How We Use Your Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>We use the information we collect for the following business purposes:</p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Order Processing and Fulfilment</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Processing and fulfilling chemical product orders</li>
                <li>Managing payment transactions via Stripe or purchase order workflows</li>
                <li>Coordinating delivery of products, including dangerous goods shipments</li>
                <li>Generating invoices, tax receipts, and order confirmations</li>
                <li>Providing Safety Data Sheets (SDS) and compliance documentation</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Communication</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Sending order updates, shipping notifications, and delivery confirmations</li>
                <li>Responding to customer support requests and inquiries</li>
                <li>Notifying you of product updates, safety alerts, or regulatory changes</li>
                <li>Sending marketing communications (only with your consent)</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Platform Improvement</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Analysing usage patterns to improve platform functionality</li>
                <li>Personalising product recommendations based on your industry</li>
                <li>Monitoring platform performance and resolving technical issues</li>
                <li>Conducting research and analytics to enhance our services</li>
              </ul>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Legal and Compliance</h4>
              <ul className="list-disc space-y-1 pl-5">
                <li>Verifying business identity and ABN for B2B transactions</li>
                <li>Complying with dangerous goods regulations and record-keeping requirements</li>
                <li>Meeting tax, GST, and financial reporting obligations</li>
                <li>Preventing fraud, unauthorised access, and other illegal activities</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 3. Information Sharing */}
        <Card id="information-sharing">
          <CardHeader>
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">3. Information Sharing</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              We do not sell your personal or business information. We may share information with the
              following parties only as necessary to operate our marketplace:
            </p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Payment Processors</h4>
              <p>
                We use Stripe as our payment processor for card transactions. When you make a payment,
                your card details are transmitted directly to Stripe under their own privacy policy and
                PCI-DSS compliance standards. We do not store complete credit card numbers on our servers.
              </p>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Delivery and Logistics Partners</h4>
              <p>
                Your delivery address and contact details are shared with our freight and transport
                partners to facilitate product delivery. For dangerous goods shipments, additional
                information may be shared as required by the Australian Dangerous Goods Code (ADG Code).
              </p>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Service Providers</h4>
              <p>
                We use third-party service providers for hosting (Vercel), database management (Supabase),
                email communications, and analytics. These providers are contractually obligated to
                protect your information and use it only for the services they provide to us.
              </p>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Legal Requirements</h4>
              <p>
                We may disclose your information if required to do so by law, in response to a court order,
                subpoena, or government request, or to protect the rights, property, or safety of CQVS,
                our customers, or the public. This includes sharing information with regulatory bodies such
                as SafeWork Australia or relevant state workplace health and safety authorities.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Data Security */}
        <Card id="data-security">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">4. Data Security</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>We implement robust security measures to protect your business information:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>All data transmitted between your browser and our servers is encrypted using TLS/SSL (HTTPS)</li>
              <li>Payment processing is handled by Stripe, which is PCI-DSS Level 1 certified</li>
              <li>Database access is restricted through role-based access controls and row-level security policies</li>
              <li>Regular security assessments and vulnerability monitoring</li>
              <li>Employee access to customer data is limited to authorised personnel on a need-to-know basis</li>
              <li>Secure password hashing and multi-factor authentication options</li>
              <li>Automated backups with encryption at rest</li>
            </ul>
            <p>
              While we strive to protect your information, no method of electronic transmission or storage
              is 100% secure. We encourage you to use strong passwords and protect your account credentials.
            </p>
          </CardContent>
        </Card>

        {/* 5. Cookies */}
        <Card id="cookies">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Cookie className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">5. Cookie Policy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>Our platform uses cookies and similar technologies to enhance your experience:</p>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Essential Cookies</h4>
              <p>
                Required for the platform to function correctly. These include authentication cookies
                that keep you signed in, shopping cart cookies, and security tokens. These cannot be
                disabled.
              </p>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Functional Cookies</h4>
              <p>
                Remember your preferences such as display settings, preferred delivery address, and
                recently viewed products. These improve your experience but are not strictly necessary.
              </p>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-foreground">Analytics Cookies</h4>
              <p>
                Help us understand how customers use the platform so we can improve functionality and
                content. We may use services such as Google Analytics or similar tools. These cookies
                collect aggregated, anonymised data.
              </p>
            </div>

            <p>
              You can manage cookie preferences through your browser settings. Note that disabling
              essential cookies may prevent the platform from functioning correctly.
            </p>
          </CardContent>
        </Card>

        {/* 6. Australian Privacy Act */}
        <Card id="australian-privacy">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">6. Australian Privacy Act Compliance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              CQVS complies with the Australian Privacy Act 1988 (Cth) and the Australian Privacy
              Principles (APPs). Our privacy practices are guided by the following principles:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>APP 1 - Open and Transparent Management:</strong> This policy outlines our
                information handling practices clearly and is freely available.
              </li>
              <li>
                <strong>APP 3 - Collection of Personal Information:</strong> We only collect information
                that is reasonably necessary for our business functions and activities.
              </li>
              <li>
                <strong>APP 5 - Notification of Collection:</strong> We notify you at or before the time
                of collection about how your information will be used.
              </li>
              <li>
                <strong>APP 6 - Use or Disclosure:</strong> We only use or disclose personal information
                for the purpose it was collected, or a related secondary purpose you would reasonably expect.
              </li>
              <li>
                <strong>APP 8 - Cross-border Disclosure:</strong> Our hosting providers may store data in
                overseas locations. Where this occurs, we take reasonable steps to ensure overseas recipients
                comply with the APPs.
              </li>
              <li>
                <strong>APP 11 - Security:</strong> We take reasonable steps to protect personal information
                from misuse, interference, loss, and unauthorised access.
              </li>
              <li>
                <strong>APP 12 - Access:</strong> You have the right to request access to your personal
                information held by us.
              </li>
              <li>
                <strong>APP 13 - Correction:</strong> You have the right to request correction of your
                personal information if it is inaccurate, out of date, or incomplete.
              </li>
            </ul>
            <p>
              If you believe we have breached the APPs, you may lodge a complaint with us or with the
              Office of the Australian Information Commissioner (OAIC) at{" "}
              <a
                href="https://www.oaic.gov.au"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                www.oaic.gov.au
              </a>.
            </p>
          </CardContent>
        </Card>

        {/* 7. Data Retention */}
        <Card id="data-retention">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">7. Data Retention</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>We retain your information for the following periods:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Account Data:</strong> Retained for as long as your account is active, plus 12
                months after account closure to facilitate reactivation if needed.
              </li>
              <li>
                <strong>Transaction Records:</strong> Retained for a minimum of 7 years as required by
                Australian tax law (ATO requirements).
              </li>
              <li>
                <strong>Dangerous Goods Records:</strong> Retained for a minimum of 5 years as required
                by workplace health and safety regulations.
              </li>
              <li>
                <strong>Communication Records:</strong> Customer support correspondence is retained for 3
                years from the date of last contact.
              </li>
              <li>
                <strong>Usage and Analytics Data:</strong> Aggregated analytics data may be retained
                indefinitely. Individual usage logs are retained for up to 24 months.
              </li>
            </ul>
            <p>
              When retention periods expire, data is securely deleted or anonymised. You may request
              earlier deletion of your data, subject to our legal and regulatory obligations.
            </p>
          </CardContent>
        </Card>

        {/* 8. Your Rights */}
        <Card id="your-rights">
          <CardHeader>
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">8. Your Rights</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>As a Chem Connect user, you have the following rights regarding your information:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Access:</strong> Request a copy of the personal and business information we hold
                about you. We will respond to access requests within 30 days.
              </li>
              <li>
                <strong>Correction:</strong> Request correction of any inaccurate or incomplete
                information. You can update most information directly through your account dashboard.
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your account and associated data, subject
                to our legal retention obligations (e.g., tax records, DG transaction records).
              </li>
              <li>
                <strong>Data Portability:</strong> Request a copy of your order history and account data
                in a machine-readable format.
              </li>
              <li>
                <strong>Marketing Opt-Out:</strong> Unsubscribe from marketing communications at any time
                via the unsubscribe link in our emails or through your account settings.
              </li>
              <li>
                <strong>Complaint:</strong> Lodge a complaint if you believe your privacy has been
                breached. We will investigate and respond within 30 days.
              </li>
            </ul>
            <p>
              To exercise any of these rights, please contact us at{" "}
              <a href="mailto:support@chemconnect.com.au" className="text-primary hover:underline">
                support@chemconnect.com.au
              </a>.
            </p>
          </CardContent>
        </Card>

        {/* 9. Children's Privacy */}
        <Card id="childrens-privacy">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">9. Children&apos;s Privacy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Chem Connect is a business-to-business (B2B) platform designed exclusively for use by
              registered businesses and their authorised representatives. Our platform is not intended
              for use by individuals under the age of 18.
            </p>
            <p>
              We do not knowingly collect personal information from minors. If we become aware that we
              have inadvertently collected information from a person under 18, we will take immediate
              steps to delete that information from our records.
            </p>
            <p>
              All account holders must be authorised representatives of a registered Australian business
              and must be of legal age to enter into binding commercial agreements.
            </p>
          </CardContent>
        </Card>

        {/* 10. Changes */}
        <Card id="changes">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">10. Changes to This Policy</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              technology, legal requirements, or other factors. When we make material changes, we will:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Update the "Last updated" date at the top of this page</li>
              <li>Notify registered users via email for significant changes</li>
              <li>Display a notice on the platform when you next sign in</li>
            </ul>
            <p>
              We encourage you to review this policy periodically. Your continued use of Chem Connect
              after changes are posted constitutes acceptance of the updated policy.
            </p>
          </CardContent>
        </Card>

        {/* 11. Contact */}
        <Card id="contact">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">11. Contact Us</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              If you have any questions about this Privacy Policy, wish to exercise your rights, or
              need to report a privacy concern, please contact us:
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="font-semibold text-foreground">CQVS - Concrete & Quarry Vending Systems</p>
              <p className="mt-1">Chem Connect Privacy Team</p>
              <p className="mt-2">
                Email:{" "}
                <a href="mailto:support@chemconnect.com.au" className="text-primary hover:underline">
                  support@chemconnect.com.au
                </a>
              </p>
              <p className="mt-3 text-xs">
                For complaints that are not resolved to your satisfaction, you may contact the Office of
                the Australian Information Commissioner (OAIC) at{" "}
                <a
                  href="https://www.oaic.gov.au"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  www.oaic.gov.au
                </a>{" "}
                or by calling 1300 363 992.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Navigation */}
      <div className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-8 sm:flex-row sm:justify-between">
        <p className="text-sm text-muted-foreground">
          See also:{" "}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Use
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
