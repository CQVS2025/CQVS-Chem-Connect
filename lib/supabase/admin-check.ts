import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "./server"

export async function requireAdmin() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error("Auth error in requireAdmin:", authError.message)
  }

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized", detail: authError?.message || "No session found" },
        { status: 401 },
      ),
      supabase,
      user: null,
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profileError) {
    console.error("Profile fetch error in requireAdmin:", profileError.message)
  }

  const role = (profile as { role: string } | null)?.role

  if (role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Forbidden", detail: `Role is "${role || "unknown"}", admin required` },
        { status: 403 },
      ),
      supabase,
      user,
    }
  }

  return { error: null, supabase, user }
}
