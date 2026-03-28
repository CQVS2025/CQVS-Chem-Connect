"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  FileText,
  Gift,
  LayoutDashboard,
  Package,
  Search,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react"

import { useProfile } from "@/lib/hooks/use-profile"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

interface NavItem {
  label: string
  href: string
  icon: typeof LayoutDashboard
  keywords?: string[]
}

const adminPages: NavItem[] = [
  { label: "Overview", href: "/admin", icon: BarChart3, keywords: ["dashboard", "home"] },
  { label: "Users", href: "/admin/users", icon: Users, keywords: ["customers", "accounts"] },
  { label: "Products", href: "/admin/products", icon: Package, keywords: ["catalog", "inventory"] },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart, keywords: ["purchases", "transactions"] },
  { label: "Quotes", href: "/admin/quotes", icon: FileText, keywords: ["requests", "pricing"] },
  { label: "Analytics", href: "/admin/analytics", icon: TrendingUp, keywords: ["reports", "metrics", "revenue"] },
  { label: "Settings", href: "/admin/settings", icon: Settings, keywords: ["config", "email", "notifications"] },
]

const customerPages: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, keywords: ["home", "overview"] },
  { label: "My Orders", href: "/dashboard/orders", icon: ShoppingCart, keywords: ["purchases", "tracking"] },
  { label: "My Quotes", href: "/dashboard/quotes", icon: FileText, keywords: ["requests", "pricing"] },
  { label: "Rewards", href: "/dashboard/rewards", icon: Gift, keywords: ["points", "loyalty"] },
  { label: "Account Settings", href: "/dashboard/settings", icon: Settings, keywords: ["profile", "company"] },
]

const marketplacePages: NavItem[] = [
  { label: "Browse Products", href: "/products", icon: Package, keywords: ["catalog", "chemicals", "shop"] },
  { label: "Shopping Cart", href: "/cart", icon: ShoppingCart, keywords: ["basket", "checkout"] },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { data: profile } = useProfile()

  const isAdmin = profile?.role === "admin"

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  const pages = isAdmin ? adminPages : customerPages

  return (
    <>
      {/* Trigger button - looks like a search bar */}
      <Button
        variant="outline"
        className="relative hidden h-9 w-56 justify-start rounded-lg bg-muted/50 text-sm text-muted-foreground lg:w-64 md:flex"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        Search...
        <kbd className="pointer-events-none absolute right-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </Button>

      {/* Mobile trigger */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">Search</span>
      </Button>

      {/* Command dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, orders, products..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Navigation */}
          <CommandGroup heading={isAdmin ? "Admin Pages" : "Dashboard"}>
            {pages.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                onSelect={() => navigate(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          {/* Marketplace */}
          <CommandGroup heading="Marketplace">
            {marketplacePages.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                onSelect={() => navigate(item.href)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
