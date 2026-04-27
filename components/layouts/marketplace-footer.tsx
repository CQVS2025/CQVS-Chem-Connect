import Link from "next/link"
import Image from "next/image"
import { MapPin, Mail } from "lucide-react"

import { cn } from "@/lib/utils"
import { getActiveWarehouses } from "@/lib/seo/warehouses"

const footerSections = [
  {
    title: "Products",
    links: [
      { label: "Marketplace", href: "/products" },
      { label: "Industries we supply", href: "/industries" },
      { label: "Custom Orders", href: "/custom-orders" },
      { label: "Safety Data Sheets", href: "/sds" },
      { label: "Locations", href: "/locations" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About CQVS", href: "/about" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "Knowledge Hub", href: "/knowledge" },
      { label: "Support & FAQs", href: "/support" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Register", href: "/register" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Use", href: "/terms" },
      { label: "Compliance", href: "/compliance" },
    ],
  },
]

export function MarketplaceFooter() {
  // Pulled from the source-of-truth warehouse data so the footer stays in
  // sync as warehouses are added / removed (no separate hand-coded list).
  const warehouses = getActiveWarehouses()

  return (
    <footer
      className={cn("border-t border-border bg-card text-card-foreground")}
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Top branding */}
        <div className="mb-12 flex items-center gap-3">
          <Image
            src="/images/cqvs-logo.png"
            alt="CQVS Chem Connect"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight">
              Chem Connect
            </span>
            <span className="text-xs text-muted-foreground">by CQVS</span>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold tracking-wide text-foreground">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={cn(
                        "text-sm text-muted-foreground transition-colors",
                        "hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* NAP - name, address, phone block. Required for local SEO
            consistency (matches the LocalBusiness schemas + GBP listings).
            Lists every active warehouse in compact form. */}
        <div className="mt-12 grid gap-6 border-t border-border pt-8 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
              <MapPin className="size-4 text-primary" /> Australian dispatch hubs
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Seven active warehouses across five states. Pick the one
              closest to your site for fastest lead times.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="size-3.5" />
              <a
                href="mailto:support@chemconnect.com.au"
                className="hover:text-foreground"
              >
                support@chemconnect.com.au
              </a>
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs text-muted-foreground sm:grid-cols-2">
            {warehouses.map((w) => (
              <li key={w.slug}>
                <Link
                  href={`/chemical-supplier/${w.slug}`}
                  className="group inline-flex flex-col leading-tight hover:text-foreground"
                >
                  <span className="font-medium text-foreground/90 group-hover:text-primary">
                    {w.city} · {w.state}
                  </span>
                  <span>
                    {w.name ? `${w.name} · ` : ""}
                    {w.street}, {w.suburb} {w.postcode}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Connecting Australian chemical manufacturers to concrete plants
            and civil sites &middot; GST-registered &middot; ABN required for
            purchases
          </p>
          <p className="text-sm text-muted-foreground">
            &copy; 2026 CQVS Chemical Marketplace
          </p>
        </div>
      </div>
    </footer>
  )
}
