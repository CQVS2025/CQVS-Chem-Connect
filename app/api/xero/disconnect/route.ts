import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  deleteXeroConnection,
  getActiveCredentials,
  getTenantConnections,
  logXeroSync,
  switchActiveTenant,
} from "@/lib/xero/client"

// POST /api/xero/disconnect - disconnect the currently active Xero org only.
//
// Flow:
//   1. Call DELETE /connections/{id} for the active tenant. Other orgs
//      authorized under the same OAuth grant stay connected on Xero's side.
//   2. Re-query /connections to see what orgs are still available.
//   3a. If any remain, switch our stored credentials to the first one and
//       run the tenant-change cleanup (clears stale xero_contact_id /
//       xero_invoice_* values scoped to the org we just disconnected).
//   3b. If none remain, delete the credentials row — fully disconnected.
export async function POST() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const creds = await getActiveCredentials()
  if (!creds) {
    // Nothing stored locally. Just log and return.
    await logXeroSync({
      entityType: "connection",
      action: "disconnect",
      status: "success",
      errorMessage: "No active Xero credentials to disconnect.",
    })
    return NextResponse.json({ ok: true, state: "already_disconnected" })
  }

  const disconnectedTenantId = creds.tenant_id
  let upstreamError: string | null = null

  // Step 1: remove the active tenant on Xero's side.
  try {
    const connections = await getTenantConnections(creds.access_token)
    const match = connections.find((c) => c.tenantId === creds.tenant_id)
    if (match) {
      await deleteXeroConnection(creds.access_token, match.id)
    }
  } catch (err) {
    upstreamError = err instanceof Error ? err.message : "Unknown error"
    console.error("Xero per-tenant disconnect failed:", upstreamError)
  }

  // Step 2: see what orgs remain authorized under the same grant.
  let remainingOrgs: Array<{
    id: string
    tenantId: string
    tenantName: string
    tenantType: string
  }> = []
  try {
    const after = await getTenantConnections(creds.access_token)
    remainingOrgs = after.filter((c) => c.tenantType === "ORGANISATION")
  } catch (err) {
    // If we can't read /connections after the delete, fall through to the
    // "no remaining" branch below — safer to clear locally than leave the
    // UI showing a tenant that may or may not still be valid.
    console.error("Failed to re-read /connections after disconnect:", err)
  }

  const supabase = createServiceRoleClient()

  if (remainingOrgs.length > 0) {
    // Step 3a: auto-switch to the next authorized org.
    const next = remainingOrgs[0]
    try {
      await switchActiveTenant({
        tenantId: next.tenantId,
        tenantName: next.tenantName,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    await logXeroSync({
      entityType: "connection",
      action: "disconnect",
      status: upstreamError ? "error" : "success",
      xeroId: disconnectedTenantId,
      errorMessage: upstreamError
        ? `Disconnected ${disconnectedTenantId} locally (Xero revoke failed: ${upstreamError}). Auto-switched active tenant to ${next.tenantName}.`
        : `Disconnected ${disconnectedTenantId} on Xero. Auto-switched active tenant to ${next.tenantName}.`,
    })

    return NextResponse.json({
      ok: true,
      state: "switched",
      revoked: !upstreamError,
      tenant_id: next.tenantId,
      tenant_name: next.tenantName,
      remaining_count: remainingOrgs.length,
    })
  }

  // Step 3b: no orgs left — fully disconnect locally too.
  const { error: deleteError } = await supabase
    .from("xero_credentials")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000")

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  await logXeroSync({
    entityType: "connection",
    action: "disconnect",
    status: upstreamError ? "error" : "success",
    xeroId: disconnectedTenantId,
    errorMessage: upstreamError
      ? `Local session cleared. Xero revoke failed: ${upstreamError}`
      : "Local session cleared. No remaining authorized orgs.",
  })

  return NextResponse.json({
    ok: true,
    state: "fully_disconnected",
    revoked: !upstreamError,
  })
}
