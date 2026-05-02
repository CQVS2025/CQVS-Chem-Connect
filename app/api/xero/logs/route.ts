import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/xero/logs - return the most recent Xero sync attempts.
//
// Migrated from the legacy xero_sync_log table to the unified
// integration_log (migration 050). Response shape preserved so the
// existing /admin/xero page keeps working without changes.
export async function GET() {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  // Only show workflow-level events (contact synced, invoice created,
  // PO emailed, etc.) — these have entity_type populated. Lower-level
  // raw HTTP rows live in /admin/integration-logs for deep diagnostics.
  const { data, error } = await supabase
    .from("integration_log")
    .select(
      "id, entity_type, entity_id, action, status, xero_id, error_message, request_payload, response_payload, created_at",
    )
    .eq("integration", "xero")
    .not("entity_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
