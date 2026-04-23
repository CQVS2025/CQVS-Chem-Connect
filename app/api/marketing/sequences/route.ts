/**
 * GET /api/marketing/sequences -- list workflows mirrored from GHL
 */

import { NextResponse } from "next/server"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { GhlWorkflows } from "@/lib/ghl"

// Live GHL call; keep a moderate timeout.
export const maxDuration = 30

export async function GET() {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  try {
    const workflows = await GhlWorkflows.listWorkflows()
    return NextResponse.json({ workflows })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
