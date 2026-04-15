import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import {
  getActiveCredentials,
  getTenantConnections,
  logXeroSync,
  switchActiveTenant,
} from "@/lib/xero/client"

// POST /api/xero/select-tenant - switch the active Xero tenant on the stored
// credentials row. Used by the org picker UI to choose which authorized
// organisation should receive invoices/POs from this app.
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const body = (await request.json().catch(() => ({}))) as {
    tenant_id?: string
  }
  const tenantId = body.tenant_id
  if (!tenantId || typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
  }

  const creds = await getActiveCredentials()
  if (!creds) {
    return NextResponse.json({ error: "Xero not connected" }, { status: 404 })
  }

  const connections = await getTenantConnections(creds.access_token)
  const match = connections.find(
    (c) => c.tenantId === tenantId && c.tenantType === "ORGANISATION",
  )
  if (!match) {
    return NextResponse.json(
      { error: "Tenant not authorized for this connection" },
      { status: 400 },
    )
  }

  try {
    const { changed } = await switchActiveTenant({
      tenantId: match.tenantId,
      tenantName: match.tenantName,
    })

    await logXeroSync({
      entityType: "connection",
      action: "tenant_selected",
      status: "success",
      xeroId: match.tenantId,
      errorMessage: changed
        ? `Selected ${match.tenantName} (tenant changed)`
        : `Selected ${match.tenantName} (no change)`,
    })

    return NextResponse.json({
      ok: true,
      tenant_id: match.tenantId,
      tenant_name: match.tenantName,
      changed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    await logXeroSync({
      entityType: "connection",
      action: "tenant_selected",
      status: "error",
      errorMessage: message,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
