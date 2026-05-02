"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Gift,
  Home,
  Layout,
  Link as LinkIcon,
  Megaphone,
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  Settings,
  Warehouse,
  LogOut,
  Truck,
  Activity,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useProfile } from "@/lib/hooks/use-profile"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  subItems?: Array<{ label: string; href: string }>
}

const navItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Overview", href: "/admin", icon: BarChart3 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Landing Page", href: "/admin/landing", icon: Layout },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Quotes", href: "/admin/quotes", icon: FileText },
  {
    label: "Marketing",
    href: "/admin/marketing",
    icon: Megaphone,
    subItems: [
      { label: "Dashboard", href: "/admin/marketing/dashboard" },
      { label: "Contacts", href: "/admin/marketing/contacts" },
      { label: "Campaigns", href: "/admin/marketing/campaigns" },
      { label: "Sequences", href: "/admin/marketing/sequences" },
      { label: "Reviews", href: "/admin/marketing/reviews" },
      { label: "Inbox", href: "/admin/marketing/inbox" },
      { label: "Settings", href: "/admin/marketing/settings" },
    ],
  },
  { label: "Rewards", href: "/admin/rewards", icon: Gift },
  { label: "Analytics", href: "/admin/analytics", icon: TrendingUp },
  { label: "Warehouses", href: "/admin/warehouses", icon: Warehouse },
  { label: "Xero", href: "/admin/xero", icon: LinkIcon },
  { label: "MacShip", href: "/admin/macship", icon: Truck },
  { label: "Integration Logs", href: "/admin/integration-logs", icon: Activity },
  { label: "Settings", href: "/admin/settings", icon: Settings },
]

function SidebarContent({
  collapsed,
  onCollapse,
  onNavClick,
}: {
  collapsed?: boolean
  onCollapse?: () => void
  onNavClick?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useProfile()

  const initials = profile?.contact_name
    ? profile.contact_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "A"

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div
          className={cn(
            "flex h-16 items-center border-b",
            collapsed ? "justify-center px-2" : "gap-2.5 px-4",
          )}
        >
          <Link
            href="/admin"
            className={cn(
              "flex items-center font-semibold tracking-tight",
              collapsed ? "justify-center" : "gap-2.5",
            )}
          >
            <Image
              src="/images/cqvs-logo.png"
              alt="CQVS"
              width={32}
              height={32}
              className="shrink-0 rounded-lg"
            />
            {!collapsed && (
              <>
                <span className="text-lg">Chem Connect</span>
                <Badge
                  variant="secondary"
                  className="ml-1 text-[10px] uppercase tracking-wider"
                >
                  Admin
                </Badge>
              </>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            "flex-1 space-y-1 overflow-y-auto py-4",
            collapsed ? "px-2" : "px-3",
          )}
        >
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && item.href !== "/admin" && pathname.startsWith(item.href))

            const link = (
              <Link
                href={item.href}
                onClick={onNavClick}
                className={cn(
                  "group flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed
                    ? "justify-center px-2 py-2.5"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              )
            }

            // Expand sub-items when the parent section is active.
            const subItemsVisible =
              !collapsed && item.subItems && isActive && item.subItems.length > 0

            return (
              <div key={item.href}>
                {link}
                {subItemsVisible && (
                  <div className="ml-7 mt-1 flex flex-col space-y-0.5 border-l border-border/60 pl-3">
                    {item.subItems!.map((sub) => {
                      const subActive =
                        pathname === sub.href || pathname.startsWith(sub.href + "/")
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={onNavClick}
                          className={cn(
                            "rounded-md px-2 py-1.5 text-xs transition-colors",
                            subActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {sub.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        {onCollapse && (
          <div className={cn("px-3 pb-2", collapsed && "flex justify-center")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={onCollapse}
                >
                  {collapsed ? (
                    <ChevronsRight className="h-4 w-4" />
                  ) : (
                    <ChevronsLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" sideOffset={8}>
                  Expand sidebar
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}

        {/* Admin User Info */}
        <div className={cn("border-t", collapsed ? "px-2 py-3" : "p-4")}>
          {profileLoading ? (
            <div
              className={cn(
                "flex items-center",
                collapsed ? "justify-center" : "gap-3",
              )}
            >
              <Skeleton className="h-9 w-9 rounded-full" />
              {!collapsed && (
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-36" />
                </div>
              )}
            </div>
          ) : collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/60 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-80"
                >
                  {initials}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p className="font-medium">
                  {profile?.contact_name || "Admin"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Click to sign out
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/60 text-xs font-bold text-primary-foreground">
                {initials}
              </div>
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium">
                  {profile?.contact_name || "Admin"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile?.email || ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Log out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

interface AdminSidebarProps {
  collapsed?: boolean
  onCollapse?: () => void
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

export function AdminSidebar({
  collapsed = false,
  onCollapse,
  mobileOpen = false,
  onMobileOpenChange,
}: AdminSidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden border-r bg-card transition-all duration-300 lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col",
          collapsed ? "lg:w-17" : "lg:w-64",
        )}
      >
        <SidebarContent collapsed={collapsed} onCollapse={onCollapse} />
      </aside>

      {/* Mobile Sidebar - always expanded */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin Navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent onNavClick={() => onMobileOpenChange?.(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
