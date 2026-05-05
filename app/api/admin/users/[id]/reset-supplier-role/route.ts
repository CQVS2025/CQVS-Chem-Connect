// POST /api/admin/users/[id]/reset-supplier-role
//
// Demotes a supplier user back to 'customer' AND removes any
// warehouse_users rows linking them. Used to clean up users that the
// pre-fix warehouse-users endpoint silently promoted from customer to
// supplier. Also useful when offboarding a supplier.
//
// Body: optional { new_role?: 'customer' | 'admin' } — defaults to 'customer'.

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

const VALID_ROLES = new Set(["customer", "admin"])

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const newRole = (body.new_role as string | undefined) ?? "customer"
  if (!VALID_ROLES.has(newRole)) {
    return NextResponse.json(
      { error: `new_role must be one of: ${[...VALID_ROLES].join(", ")}` },
      { status: 400 },
    )
  }

  const service = createServiceRoleClient()

  const { data: profile } = await service
    .from("profiles")
    .select("id, email, role")
    .eq("id", id)
    .single()
  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Remove any warehouse links so the dashboard scope clears immediately.
  const { error: unlinkErr } = await service
    .from("warehouse_users")
    .delete()
    .eq("user_id", id)
  if (unlinkErr) {
    return NextResponse.json({ error: unlinkErr.message }, { status: 500 })
  }

  const { error: roleErr } = await service
    .from("profiles")
    .update({ role: newRole })
    .eq("id", id)
  if (roleErr) {
    return NextResponse.json({ error: roleErr.message }, { status: 500 })
  }

  console.log(
    `[reset-supplier-role] ${
      (profile as { email: string }).email
    }: ${(profile as { role: string }).role} → ${newRole}, warehouse_users cleared`,
  )

  return NextResponse.json({
    ok: true,
    user_id: id,
    previous_role: (profile as { role: string }).role,
    new_role: newRole,
  })
}
