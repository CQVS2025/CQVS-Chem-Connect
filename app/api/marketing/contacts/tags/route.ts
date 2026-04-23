/**
 * GET /api/marketing/contacts/tags — list every tag in use, with counts.
 * Used by the campaign-builder to suggest tags rather than forcing free-text.
 */

import { NextResponse } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET() {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  const supabase = createServiceRoleClient()
  const { data, error: rpcError } = await supabase.rpc(
    "list_marketing_contact_tags",
  )
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  return NextResponse.json({
    tags: (data ?? []) as Array<{ tag: string; count: number }>,
  })
}
