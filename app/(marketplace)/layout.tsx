import type { ReactNode } from "react"

import { MarketplaceNavbar } from "@/components/layouts/marketplace-navbar"
import { MarketplaceFooter } from "@/components/layouts/marketplace-footer"
import { PageTransition } from "@/components/shared/page-transition"

export default function MarketplaceLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketplaceNavbar />
      <main className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <MarketplaceFooter />
    </div>
  )
}
