import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// POST /api/auth/sign-out
// Clears the Supabase session and redirects to /login.
// Used by the supplier dashboard layout's sign-out button.
export async function POST() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  const url = new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
  return NextResponse.redirect(url, { status: 303 })
}
