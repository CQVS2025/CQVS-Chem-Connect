import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { buildAuthUrl } from "@/lib/xero/client"

// GET /api/auth/xero - kick off Xero OAuth flow (admin only)
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const state = randomBytes(16).toString("hex")
  const redirectUri = `${request.nextUrl.origin}/api/auth/xero/callback`

  const authUrl = buildAuthUrl(redirectUri, state)

  // Persist state in a short-lived cookie for CSRF protection
  const response = NextResponse.redirect(authUrl)
  response.cookies.set("xero_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  })

  return response
}
