"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { DashboardSidebar } from "@/components/layouts/dashboard-sidebar"
import { DashboardHeader } from "@/components/layouts/dashboard-header"
import { PageTransition } from "@/components/shared/page-transition"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="relative min-h-screen">
      <DashboardSidebar
        collapsed={collapsed}
        onCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <div
        className={cn(
          "flex min-h-screen flex-col transition-all duration-300",
          collapsed ? "md:pl-17" : "md:pl-65",
        )}
      >
        <DashboardHeader
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed(!collapsed)}
          onMobileMenuToggle={() => setMobileOpen(true)}
        />

        <main className="flex-1 p-6 md:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}
