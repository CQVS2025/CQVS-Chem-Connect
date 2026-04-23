/**
 * Builds and redirects to the GHL Marketplace App install URL.
 *
 * Mirrors the Install Link GHL generates in the app dashboard:
 *   /v2/oauth/chooselocation  (NOT /oauth/chooselocation — that 404s into
 *   "No integration found" because it can't resolve the version)
 *
 * Scopes + optional version_id must match what's configured in the app's
 * Auth settings, otherwise install fails with a scope-mismatch error.
 */

import { NextResponse } from "next/server"

// Must match the scope list saved in Advanced Settings → Auth on the GHL
// app. If they drift, GHL rejects the install. Keep in sync.
const INSTALL_SCOPES = ["lc-email.readonly"].join(" ")

export function GET() {
  const clientId = process.env.GHL_MARKETPLACE_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!clientId || !appUrl) {
    return NextResponse.json(
      { error: "GHL_MARKETPLACE_CLIENT_ID or NEXT_PUBLIC_APP_URL not set" },
      { status: 500 },
    )
  }

  const redirectUri = `${appUrl}/api/oauth/callback`
  const params = new URLSearchParams({
    response_type: "code",
    redirect_uri: redirectUri,
    client_id: clientId,
    scope: INSTALL_SCOPES,
  })

  // GHL derives version_id from the base (pre-suffix) part of the client ID.
  const versionId = clientId.split("-")[0]
  if (versionId) params.set("version_id", versionId)

  return NextResponse.redirect(
    `https://marketplace.leadconnectorhq.com/v2/oauth/chooselocation?${params}`,
  )
}
