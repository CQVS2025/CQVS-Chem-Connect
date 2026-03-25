import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/supabase/admin-check"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/admin/users/[id]
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PUT /api/admin/users/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = await request.json()

  // Only allow updating specific fields on the profile
  const allowed: Record<string, unknown> = {}
  if (body.role !== undefined) allowed.role = body.role
  if (body.status !== undefined) allowed.status = body.status
  if (body.company_name !== undefined) allowed.company_name = body.company_name
  if (body.contact_name !== undefined) allowed.contact_name = body.contact_name
  if (body.phone !== undefined) allowed.phone = body.phone

  // If status is changing, also ban/unban in Supabase Auth
  // This invalidates their sessions and prevents login
  if (body.status !== undefined) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Server misconfigured: missing service role key" },
        { status: 500 },
      )
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    if (body.status === "suspended") {
      // Ban the user - this invalidates all sessions immediately
      const { error: banError } = await adminClient.auth.admin.updateUserById(
        id,
        { ban_duration: "876600h" }, // ~100 years = effectively permanent
      )
      if (banError) {
        console.error("Failed to ban user:", banError.message)
        return NextResponse.json({ error: banError.message }, { status: 500 })
      }
    } else if (body.status === "active") {
      // Unban the user
      const { error: unbanError } = await adminClient.auth.admin.updateUserById(
        id,
        { ban_duration: "none" },
      )
      if (unbanError) {
        console.error("Failed to unban user:", unbanError.message)
        return NextResponse.json({ error: unbanError.message }, { status: 500 })
      }
    }
  }

  // Update the profile
  const { data, error } = await supabase
    .from("profiles")
    .update(allowed)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
