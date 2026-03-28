import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("admin_settings")
      .select("key, value")

    if (error) {
      console.error("Failed to fetch settings:", error.message)
      return NextResponse.json(
        { error: "Failed to fetch settings" },
        { status: 500 },
      )
    }

    const settings: Record<string, string> = {}
    for (const row of data ?? []) {
      settings[row.key] = row.value
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Settings GET error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    const body = await request.json()

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object of key-value pairs" },
        { status: 400 },
      )
    }

    const entries = Object.entries(body) as [string, string][]

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No settings provided" },
        { status: 400 },
      )
    }

    // Upsert each setting
    for (const [key, value] of entries) {
      const { error } = await supabase
        .from("admin_settings")
        .upsert(
          { key, value: String(value) },
          { onConflict: "key" },
        )

      if (error) {
        console.error(`Failed to upsert setting "${key}":`, error.message)
        return NextResponse.json(
          { error: `Failed to update setting "${key}"` },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Settings PUT error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
