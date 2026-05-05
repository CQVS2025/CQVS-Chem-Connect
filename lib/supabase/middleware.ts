import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ["/dashboard", "/admin", "/checkout", "/supplier"]
  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path),
  )

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // For authenticated users on protected/auth pages, fetch profile for role & status
  let userRole: string | null = null
  let userStatus: string | null = null

  if (user) {
    const needsProfile =
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard") ||
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/cart" ||
      pathname === "/checkout"

    if (needsProfile || pathname.startsWith("/supplier")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", user.id)
        .single()

      userRole = (profile as { role: string; status: string } | null)?.role ?? "customer"
      userStatus = (profile as { role: string; status: string } | null)?.status ?? "active"
    }
  }

  // Suspended users - sign them out and redirect to login with message
  if (user && userStatus === "suspended") {
    // Clear the auth session by signing out
    await supabase.auth.signOut()

    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("suspended", "true")

    // Build a new response that clears cookies
    const redirectResponse = NextResponse.redirect(url)

    // Copy cookie deletions from the signOut
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        ...cookie,
        maxAge: 0,
      })
    })

    return redirectResponse
  }

  // Helper: send a user to their role's home page.
  const homeForRole = (role: string | null): string => {
    if (role === "admin") return "/admin"
    if (role === "supplier") return "/supplier"
    return "/dashboard"
  }

  // Admin routes - only admin role can access
  if (pathname.startsWith("/admin") && user) {
    if (userRole !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = homeForRole(userRole)
      return NextResponse.redirect(url)
    }
  }

  // Supplier routes - only supplier (or admin for ops) can access
  if (pathname.startsWith("/supplier") && user) {
    if (userRole !== "supplier" && userRole !== "admin") {
      const url = request.nextUrl.clone()
      url.pathname = homeForRole(userRole)
      return NextResponse.redirect(url)
    }
  }

  // Buyer dashboard - only customers should see this. Admins go to /admin,
  // suppliers go to /supplier (their dashboard).
  if (pathname.startsWith("/dashboard") && user) {
    if (userRole === "admin") {
      const url = request.nextUrl.clone()
      url.pathname = "/admin"
      return NextResponse.redirect(url)
    }
    if (userRole === "supplier") {
      const url = request.nextUrl.clone()
      url.pathname = "/supplier"
      return NextResponse.redirect(url)
    }
  }

  // Cart / checkout - ordering is customer-only. Admins and suppliers
  // get bounced to their respective home page.
  if ((pathname === "/cart" || pathname === "/checkout") && user) {
    if (userRole === "admin" || userRole === "supplier") {
      const url = request.nextUrl.clone()
      url.pathname = homeForRole(userRole)
      return NextResponse.redirect(url)
    }
  }

  // Redirect logged-in users away from auth pages
  const authPaths = ["/login", "/register", "/forgot-password"]
  const isAuthPage = authPaths.some((path) => pathname === path)

  if (isAuthPage && user) {
    const url = request.nextUrl.clone()
    url.pathname = homeForRole(userRole)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
