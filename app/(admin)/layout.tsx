"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { AdminSidebar } from "@/components/layouts/admin-sidebar"
import { AdminHeader } from "@/components/layouts/admin-header"
import { PageTransition } from "@/components/shared/page-transition"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="relative min-h-screen bg-background">
      <AdminSidebar
        collapsed={collapsed}
        onCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "lg:pl-17" : "lg:pl-64",
        )}
      >
        <AdminHeader
          collapsed={collapsed}
          onCollapseToggle={() => setCollapsed(!collapsed)}
          onMobileMenuToggle={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}
