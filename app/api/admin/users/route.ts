import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/admin/users - list all users (admin only)
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { searchParams } = request.nextUrl
  const search = searchParams.get("search")
  const role = searchParams.get("role")
  const status = searchParams.get("status")

  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })

  if (role && role !== "all") {
    query = query.eq("role", role)
  }

  if (status && status !== "all") {
    query = query.eq("status", status)
  }

  if (search) {
    query = query.or(
      `contact_name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`,
    )
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
