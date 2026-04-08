import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { getActiveCredentials } from "@/lib/xero/client"

// GET /api/xero/status - check if Xero is connected (admin only)
export async function GET() {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const creds = await getActiveCredentials()
  if (!creds) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    tenant_id: creds.tenant_id,
    tenant_name: creds.tenant_name,
    expires_at: creds.expires_at,
    scope: creds.scope,
  })
}
