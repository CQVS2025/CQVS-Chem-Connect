import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// GET /api/settings/public - return public-facing feature flags (no auth required)
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ quotes_enabled: true })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data } = await supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ["quotes_enabled"])

    const settings: Record<string, string> = {}
    for (const row of data ?? []) {
      settings[row.key] = row.value
    }

    return NextResponse.json({
      quotes_enabled: settings.quotes_enabled !== "false",
    })
  } catch {
    return NextResponse.json({ quotes_enabled: true })
  }
}
