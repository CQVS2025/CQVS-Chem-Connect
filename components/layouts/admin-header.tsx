"use client"

import { usePathname } from "next/navigation"
import { Menu, PanelLeftClose, PanelLeftOpen, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { useProfile } from "@/lib/hooks/use-profile"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { CommandPalette } from "@/components/shared/command-palette"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const breadcrumbMap: Record<string, string> = {
  "/admin": "Overview",
  "/admin/users": "Users",
  "/admin/products": "Products",
  "/admin/orders": "Orders",
  "/admin/quotes": "Quotes",
  "/admin/analytics": "Analytics",
  "/admin/settings": "Settings",
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean)
  const crumbs: { label: string; href: string }[] = []

  let currentPath = ""
  for (const segment of segments) {
    currentPath += `/${segment}`
    const label =
      breadcrumbMap[currentPath] ||
      segment.charAt(0).toUpperCase() + segment.slice(1)
    crumbs.push({ label, href: currentPath })
  }

  return crumbs
}

interface AdminHeaderProps {
  collapsed?: boolean
  onCollapseToggle?: () => void
  onMobileMenuToggle?: () => void
}

export function AdminHeader({ collapsed, onCollapseToggle, onMobileMenuToggle }: AdminHeaderProps) {
  const pathname = usePathname()
  const breadcrumbs = getBreadcrumbs(pathname)
  const { data: profile, isLoading: profileLoading } = useProfile()

  const initials = profile?.contact_name
    ? profile.contact_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "A"

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-6">
      {/* Mobile menu trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open menu"
        onClick={onMobileMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Sidebar collapse toggle - desktop */}
      {onCollapseToggle && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onCollapseToggle}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </Button>
      )}

      {/* Breadcrumbs */}
      <nav className="hidden items-center gap-1 text-sm md:flex">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.href} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span
              className={cn(
                "font-medium",
                index === breadcrumbs.length - 1
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {crumb.label}
            </span>
          </div>
        ))}
      </nav>

      {/* Mobile title */}
      <h1 className="text-lg font-semibold md:hidden">
        {breadcrumbs[breadcrumbs.length - 1]?.label ?? "Admin"}
      </h1>

      {/* Right section */}
      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />

        <ThemeToggle />

        {profileLoading ? (
          <Skeleton className="h-9 w-9 rounded-full" />
        ) : (
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/60 text-xs font-bold text-primary-foreground ring-2 ring-background transition-shadow hover:ring-primary/20">
            {initials}
          </button>
        )}
      </div>
    </header>
  )
}
