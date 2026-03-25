import Link from "next/link"
import Image from "next/image"

import { cn } from "@/lib/utils"

const footerSections = [
  {
    title: "Products",
    links: [
      { label: "Marketplace", href: "/products" },
      { label: "Custom Orders", href: "#" },
      { label: "Safety Data Sheets", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About CQVS", href: "#" },
      { label: "How It Works", href: "/#how-it-works" },
      { label: "Support", href: "#" },
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
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Use", href: "#" },
      { label: "Compliance", href: "#" },
    ],
  },
]

export function MarketplaceFooter() {
  return (
    <footer
      className={cn("border-t border-border bg-card text-card-foreground")}
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Top branding */}
        <div className="mb-12 flex items-center gap-3">
          <Image
            src="/images/cqvs-logo.png"
            alt="CQVS"
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

        {/* Bottom Bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Connecting chemical manufacturers to concrete plants and civil sites
          </p>
          <p className="text-sm text-muted-foreground">
            &copy; 2026 CQVS Chemical Marketplace
          </p>
        </div>
      </div>
    </footer>
  )
}
