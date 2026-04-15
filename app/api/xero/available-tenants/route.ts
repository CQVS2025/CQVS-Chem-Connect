import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { getActiveCredentials, getTenantConnections } from "@/lib/xero/client"

// GET /api/xero/available-tenants - list every Xero org the current access
// token can see. Used by the org picker UI so admins can pick which tenant
// this app should be connected to when multiple orgs are authorized.
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const creds = await getActiveCredentials()
  if (!creds) {
    return NextResponse.json({ error: "Xero not connected" }, { status: 404 })
  }

  try {
    const connections = await getTenantConnections(creds.access_token)
    const orgs = connections.filter((c) => c.tenantType === "ORGANISATION")
    return NextResponse.json({
      active_tenant_id: creds.tenant_id,
      tenants: orgs.map((c) => ({
        tenant_id: c.tenantId,
        tenant_name: c.tenantName,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
