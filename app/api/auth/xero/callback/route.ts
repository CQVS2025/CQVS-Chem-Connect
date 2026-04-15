import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  exchangeCodeForTokens,
  getTenantConnections,
  logXeroSync,
} from "@/lib/xero/client"

// GET /api/auth/xero/callback - OAuth callback from Xero
export async function GET(request: NextRequest) {
  const { error: authError, user } = await requireAdmin()
  if (authError) return authError

  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const error = request.nextUrl.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/xero?error=${encodeURIComponent(error)}`, request.url),
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin/xero?error=missing_code", request.url),
    )
  }

  // CSRF check
  const cookieState = request.cookies.get("xero_oauth_state")?.value
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(
      new URL("/admin/xero?error=invalid_state", request.url),
    )
  }

  try {
    const redirectUri = `${request.nextUrl.origin}/api/auth/xero/callback`
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    // Get tenant ID from /connections
    const connections = await getTenantConnections(tokens.access_token)
    const orgConnection =
      connections.find((c) => c.tenantType === "ORGANISATION") ?? connections[0]

    if (!orgConnection) {
      throw new Error("No Xero organisation found for this connection")
    }

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString()

    const supabase = createServiceRoleClient()

    // Check whether we're reconnecting to the same tenant or a different one.
    // Stored xero_contact_id and xero_invoice_id values are tenant-specific
    // and become invalid if the user reconnects to a different Xero org.
    const { data: existingCreds } = await supabase
      .from("xero_credentials")
      .select("tenant_id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const isDifferentTenant =
      existingCreds && existingCreds.tenant_id !== orgConnection.tenantId

    // Replace any existing credentials (we only support one connection)
    await supabase
      .from("xero_credentials")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")

    const { error: insertError } = await supabase
      .from("xero_credentials")
      .insert({
        tenant_id: orgConnection.tenantId,
        tenant_name: orgConnection.tenantName,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
        scope: tokens.scope ?? null,
        connected_by: user?.id ?? null,
      })

    if (insertError) {
      throw new Error(`Failed to save credentials: ${insertError.message}`)
    }

    // If we connected to a different tenant, clear all stored Xero IDs
    // since they belong to the previous org and won't resolve in the new one.
    if (isDifferentTenant) {
      await supabase
        .from("profiles")
        .update({ xero_contact_id: null })
        .not("xero_contact_id", "is", null)

      await supabase
        .from("orders")
        .update({
          xero_invoice_id: null,
          xero_invoice_number: null,
          xero_invoice_status: null,
          xero_synced_at: null,
        })
        .not("xero_invoice_id", "is", null)

      await logXeroSync({
        entityType: "connection",
        action: "tenant_changed",
        status: "success",
        xeroId: orgConnection.tenantId,
        errorMessage:
          "Reconnected to a different tenant - cleared all stored xero_contact_id and xero_invoice_id values.",
      })
    }

    await logXeroSync({
      entityType: "connection",
      action: "connect",
      status: "success",
      xeroId: orgConnection.tenantId,
    })

    // If the user authorized multiple organisations, send them to the picker
    // so they can confirm which one this app should use. Otherwise go straight
    // back to the admin page.
    const orgCount = connections.filter(
      (c) => c.tenantType === "ORGANISATION",
    ).length
    const destination =
      orgCount > 1
        ? "/admin/xero/choose-org?initial=1"
        : "/admin/xero?connected=1"

    const response = NextResponse.redirect(new URL(destination, request.url))
    response.cookies.delete("xero_oauth_state")
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    await logXeroSync({
      entityType: "connection",
      action: "connect",
      status: "error",
      errorMessage: message,
    })
    return NextResponse.redirect(
      new URL(
        `/admin/xero?error=${encodeURIComponent(message)}`,
        request.url,
      ),
    )
  }
}
