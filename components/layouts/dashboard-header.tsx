"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { useProfile } from "@/lib/hooks/use-profile"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { CommandPalette } from "@/components/shared/command-palette"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/shared/theme-toggle"

interface DashboardHeaderProps {
  collapsed?: boolean
  onCollapseToggle?: () => void
  onMobileMenuToggle?: () => void
}

export function DashboardHeader({ collapsed, onCollapseToggle, onMobileMenuToggle }: DashboardHeaderProps) {
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useProfile()

  const initials = profile?.contact_name
    ? profile.contact_name
        .split(" ")
        .map((n: string) => n[0])
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
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-xl md:px-6",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open menu"
        onClick={onMobileMenuToggle}
      >
        <Menu className="size-5" />
      </Button>

      {/* Sidebar collapse toggle - desktop */}
      {onCollapseToggle && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onCollapseToggle}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <PanelLeftClose className="size-5" />
          )}
        </Button>
      )}

      <div className="hidden flex-1 md:block" />

      <div className="ml-auto flex items-center gap-2">
        <CommandPalette />

        <ThemeToggle />

        {profileLoading ? (
          <Skeleton className="size-8 rounded-full" />
        ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="User menu"
            >
              {profile?.company_logo_url ? (
                <img src={profile.company_logo_url} alt="" className="size-7 rounded-full object-cover" />
              ) : (
                <div className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">
                {profile?.contact_name || "User"}
              </p>
              <p className="text-xs text-muted-foreground">
                {profile?.email || ""}
              </p>
              {profile?.company_name && (
                <p className="text-xs text-muted-foreground">
                  {profile.company_name}
                </p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <User className="mr-2 h-4 w-4" />
                Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>
    </header>
  )
}
