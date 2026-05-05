// POST /api/auth/email-status
//
// Pre-signup check: tells the register form whether the supplied email
// is already in use, and if so, what role it has. Lets the form show a
// targeted error ("you are already registered as a supplier - use a
// different email to create a customer account") instead of a generic
// duplicate message.
//
// Uses the service-role client so the lookup works even with strict RLS
// on profiles. Only returns { exists, role } - never any other profile
// data, so it's safe to expose unauthenticated.

import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export async function POST(request: NextRequest) {
  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const email = (body.email ?? "").trim().toLowerCase()
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .ilike("email", email)
    .maybeSingle()

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned, which is fine here.
    console.error("[email-status] lookup failed:", error.message)
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ exists: false, role: null })
  }
  return NextResponse.json({
    exists: true,
    role: (data as { role?: string }).role ?? null,
  })
}
