import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET() {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const { data, error: fetchError } = await supabase
    .from("early_access_signups")
    .select("*")
    .order("created_at", { ascending: false })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
