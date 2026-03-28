"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { domAnimation, LazyMotion, m } from "framer-motion"
import { LayoutDashboard, LogOut, Menu, ShoppingCart, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { useUser } from "@/lib/hooks/use-auth"
import { useProfile } from "@/lib/hooks/use-profile"
import { useCart } from "@/lib/hooks/use-cart"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/shared/theme-toggle"

const navLinks = [
  { label: "Products", href: "/products" },
  { label: "How It Works", href: "/#how-it-works" },
]

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div whileHover={{ y: -1 }} transition={{ duration: 0.15 }}>
        <Link
          href={href}
          className={cn(
            "relative px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
            "hover:text-foreground",
            "after:absolute after:inset-x-3 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200",
            "hover:after:scale-x-100",
          )}
        >
          {children}
        </Link>
      </m.div>
    </LazyMotion>
  )
}

export function MarketplaceNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { user, loading: authLoading } = useUser()
  const { data: profile } = useProfile()
  const { data: cartItems } = useCart()
  const cartCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  const isAdmin = profile?.role === "admin"
  const dashboardHref = isAdmin ? "/admin" : "/dashboard"

  const initials = profile?.contact_name
    ? profile.contact_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  useEffect(() => {
    setMounted(true)
    function onScroll() {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 pt-4">
      <nav
        className={cn(
          "flex w-full max-w-5xl items-center justify-between rounded-2xl px-4 py-2.5 transition-all duration-300",
          "border border-white/8 bg-background/60 backdrop-blur-xl backdrop-saturate-150",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_20px_rgba(0,0,0,0.15)]",
          scrolled && "bg-background/75 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_30px_rgba(0,0,0,0.25)]",
        )}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/images/cqvs-logo.png"
            alt="CQVS"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight">
              Chem Connect
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              by CQVS
            </span>
          </div>
        </Link>

        {/* Center Nav - Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.label} href={link.href}>
              {link.label}
            </NavLink>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          {!isAdmin && (
          <Button variant="ghost" size="icon" className="relative h-9 w-9" asChild>
            <Link href="/cart">
              <ShoppingCart className="size-4" />
              {cartCount > 0 && (
                <Badge
                  className={cn(
                    "absolute -right-1 -top-1 flex size-4 items-center justify-center p-0 text-[10px]",
                  )}
                >
                  {cartCount > 99 ? "99+" : cartCount}
                </Badge>
              )}
              <span className="sr-only">Cart</span>
            </Link>
          </Button>
          )}

          <ThemeToggle />

          {!authLoading && (
            <div className="hidden items-center gap-1.5 md:flex">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-9 w-9"
                    >
                      {profile?.company_logo_url ? (
                        <img src={profile.company_logo_url} alt="" className="size-7 rounded-full object-cover" />
                      ) : (
                        <div className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
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
                        {profile?.email || user.email}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={dashboardHref}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        {isAdmin ? "Admin Dashboard" : "Dashboard"}
                      </Link>
                    </DropdownMenuItem>
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
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 rounded-xl text-xs shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/40 transition-shadow duration-200"
                    asChild
                  >
                    <Link href="/register">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Mobile menu - render only after mount to avoid Radix ID hydration mismatch */}
          {!mounted && (
            <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden">
              <Menu className="size-5" />
            </Button>
          )}
          {mounted && <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2.5">
                  <Image
                    src="/images/cqvs-logo.png"
                    alt="CQVS"
                    width={24}
                    height={24}
                    className="rounded"
                  />
                  Chem Connect
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-1 px-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors",
                      "hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-2 border-t border-border px-4 pt-4">
                {user ? (
                  <>
                    <div className="mb-2 flex items-center gap-3 px-1">
                      {profile?.company_logo_url ? (
                        <img src={profile.company_logo_url} alt="" className="size-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {profile?.contact_name || "User"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {profile?.email || user.email}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href={dashboardHref} onClick={() => setMobileOpen(false)}>
                        {isAdmin ? "Admin Dashboard" : "Dashboard"}
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => { setMobileOpen(false); handleSignOut() }}
                    >
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/login" onClick={() => setMobileOpen(false)}>
                        Sign In
                      </Link>
                    </Button>
                    <Button
                      className={cn(
                        "w-full shadow-md shadow-primary/25",
                        "hover:shadow-lg hover:shadow-primary/40",
                        "transition-shadow duration-200",
                      )}
                      asChild
                    >
                      <Link href="/register" onClick={() => setMobileOpen(false)}>
                        Get Started
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>}
        </div>
      </nav>
    </header>
  )
}
