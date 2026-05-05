import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { LogOut, Package, Truck } from "lucide-react"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export default async function SupplierLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/supplier")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, contact_name, email")
    .eq("id", user.id)
    .single()

  const role = (profile as { role?: string } | null)?.role
  if (role !== "supplier" && role !== "admin") {
    redirect("/dashboard")
  }

  const contactName =
    (profile as { contact_name?: string | null } | null)?.contact_name ?? null
  const email = (profile as { email?: string } | null)?.email ?? user.email
  const initials = (contactName ?? email ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link
            href="/supplier"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <Image
              src="/images/cqvs-logo.png"
              alt="Chem Connect"
              width={36}
              height={36}
              className="rounded-md"
              priority
            />
            <div className="leading-tight">
              <div className="text-base font-semibold text-foreground">
                Chem Connect
              </div>
              <div className="text-xs text-muted-foreground">
                Supplier portal
              </div>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 sm:gap-3">
            <Link
              href="/supplier"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Package className="h-3.5 w-3.5" />
              Orders
            </Link>

            <Link
              href="/supplier/freight-matrix"
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Truck className="h-3.5 w-3.5" />
              Freight Matrix
            </Link>

            <div className="flex items-center gap-2 border-l border-border pl-3 sm:pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials || "?"}
              </div>
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-medium text-foreground">
                  {contactName ?? "Supplier"}
                </div>
                <div className="text-xs text-muted-foreground">{email}</div>
              </div>
              <form action="/api/auth/sign-out" method="post">
                <button
                  type="submit"
                  className="ml-1 inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </form>
            </div>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-muted-foreground">
        Chem Connect by CQVS · Supplier portal
      </footer>
    </div>
  )
}
