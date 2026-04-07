import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/xero/logs - return the most recent Xero sync attempts
export async function GET() {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { data, error } = await supabase
    .from("xero_sync_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
