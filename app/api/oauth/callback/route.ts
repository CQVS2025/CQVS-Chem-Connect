/**
 * GHL Marketplace App OAuth callback.
 *
 * Flow:
 *   1. Admin opens the Install URL (see /api/oauth/install).
 *   2. GHL asks which sub-account to install onto; admin picks CQVS.
 *   3. GHL redirects here with ?code=<authCode>&locationId=<id>.
 *   4. We exchange the code for access + refresh tokens via
 *      POST https://services.leadconnectorhq.com/oauth/token.
 *
 * The LCEmailStats webhook fires automatically once the app is installed —
 * no token needed to receive events. Tokens are logged here for operator
 * visibility and stored in `ghl_oauth_tokens` for future API use (e.g. if
 * we later want to query message details by ID).
 */

import { NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { logWebhook } from "@/lib/ghl/webhook-log"

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
  userType?: string
  companyId?: string
  locationId?: string
  userId?: string
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const errorParam = url.searchParams.get("error")

  if (errorParam) {
    logWebhook("oauth", "❌ install rejected", {
      error: errorParam,
      description: url.searchParams.get("error_description"),
    })
    return NextResponse.json(
      { error: errorParam, description: url.searchParams.get("error_description") },
      { status: 400 },
    )
  }

  if (!code) {
    return NextResponse.json({ error: "Missing ?code parameter" }, { status: 400 })
  }

  const clientId = process.env.GHL_MARKETPLACE_CLIENT_ID
  const clientSecret = process.env.GHL_MARKETPLACE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "GHL_MARKETPLACE_CLIENT_ID / GHL_MARKETPLACE_CLIENT_SECRET not set" },
      { status: 500 },
    )
  }

  const baseUrl =
    process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com"
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    user_type: "Location",
  })

  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  const json = (await res.json()) as TokenResponse & { message?: string }
  if (!res.ok) {
    logWebhook("oauth", "❌ token exchange failed", {
      status: res.status,
      response: json,
    })
    return NextResponse.json(
      { error: "Token exchange failed", status: res.status, detail: json },
      { status: 502 },
    )
  }

  const expiresAt = new Date(Date.now() + (json.expires_in ?? 0) * 1000).toISOString()

  logWebhook("oauth", "✅ tokens received", {
    locationId: json.locationId ?? null,
    companyId: json.companyId ?? null,
    userType: json.userType ?? null,
    scope: json.scope ?? null,
    expires_at: expiresAt,
  })

  // Best-effort token persistence. If the table doesn't exist yet, we
  // still succeed — the LCEmailStats webhook works without stored tokens.
  try {
    const supabase = createServiceRoleClient()
    // Atomic upsert. The (location_id, company_id) pair is the install
    // identity. A single read-then-write would race when GHL fires two
    // OAuth callbacks close together during a reinstall. We resolve the
    // collision by updating the existing row on duplicate constraint.
    const row = {
      location_id: json.locationId ?? null,
      company_id: json.companyId ?? null,
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      token_type: json.token_type,
      scope: json.scope ?? null,
      user_type: json.userType ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }
    const insert = await supabase.from("ghl_oauth_tokens").insert(row)
    let error = insert.error
    if (error && error.code === "23505") {
      // Unique violation — row already exists, update in place.
      let q = supabase.from("ghl_oauth_tokens").update(row)
      q = json.locationId
        ? q.eq("location_id", json.locationId)
        : q.is("location_id", null)
      q = json.companyId
        ? q.eq("company_id", json.companyId)
        : q.is("company_id", null)
      const upd = await q
      error = upd.error
    }
    if (error) {
      logWebhook("oauth", "⚠️ token persist skipped", { error: error.message })
    }
  } catch (e) {
    logWebhook("oauth", "⚠️ token persist threw", {
      error: e instanceof Error ? e.message : String(e),
    })
  }

  // Land on the marketing admin page with a success flag.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  return NextResponse.redirect(`${appUrl}/admin/marketing?install=success`)
}
