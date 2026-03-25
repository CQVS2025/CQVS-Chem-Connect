"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronsLeft,
  ChevronsRight,
  FlaskConical,
  Gift,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useProfile } from "@/lib/hooks/use-profile"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Orders", href: "/dashboard/orders", icon: Package },
  { label: "Browse Products", href: "/products", icon: FlaskConical },
  { label: "Rewards", href: "/dashboard/rewards", icon: Gift },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
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
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div
          className={cn(
            "flex items-center border-b",
            collapsed ? "justify-center px-2 py-5" : "gap-2.5 px-6 py-5",
          )}
        >
          <Image
            src="/images/cqvs-logo.png"
            alt="CQVS"
            width={36}
            height={36}
            className="shrink-0 rounded-lg"
          />
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <h1 className="text-lg font-bold tracking-tight">Chem Connect</h1>
              <span className="text-[10px] font-medium text-muted-foreground">
                by CQVS
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 space-y-1 py-2", collapsed ? "px-2" : "px-3")}>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))

            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                className={cn(
                  "group flex items-center rounded-xl text-sm font-medium transition-all duration-200",
                  collapsed
                    ? "justify-center px-2 py-2.5"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm dark:bg-primary/15"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon
                  className={cn(
                    "size-[18px] shrink-0 transition-colors",
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

            return link
          })}
        </nav>

        {/* Collapse toggle - desktop only */}
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

        {/* User section */}
        <div className={cn("border-t", collapsed ? "px-2 py-3" : "px-4 py-4")}>
          {profileLoading ? (
            <div
              className={cn(
                "flex items-center",
                collapsed ? "justify-center" : "gap-3",
              )}
            >
              <Skeleton className="size-9 rounded-full" />
              {!collapsed && (
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              )}
            </div>
          ) : collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSignOut}
                  className="mx-auto flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  {initials}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p className="font-medium">{profile?.contact_name || "User"}</p>
                <p className="text-xs text-muted-foreground">
                  Click to sign out
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {profile?.contact_name || "User"}
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

interface DashboardSidebarProps {
  collapsed?: boolean
  onCollapse?: () => void
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

export function DashboardSidebar({
  collapsed = false,
  onCollapse,
  mobileOpen = false,
  onMobileOpenChange,
}: DashboardSidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r bg-card transition-all duration-300 md:block",
          collapsed ? "w-[68px]" : "w-65",
        )}
      >
        <SidebarContent collapsed={collapsed} onCollapse={onCollapse} />
      </aside>

      {/* Mobile sidebar (Sheet) - always expanded */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-65 p-0">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarContent onNavClick={() => onMobileOpenChange?.(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
