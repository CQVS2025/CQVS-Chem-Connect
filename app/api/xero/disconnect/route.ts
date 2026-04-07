import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { logXeroSync } from "@/lib/xero/client"

// POST /api/xero/disconnect - remove stored Xero credentials (admin only)
export async function POST() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from("xero_credentials")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logXeroSync({
    entityType: "connection",
    action: "disconnect",
    status: "success",
  })

  return NextResponse.json({ ok: true })
}
