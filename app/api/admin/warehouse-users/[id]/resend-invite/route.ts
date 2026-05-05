// POST /api/admin/warehouse-users/[id]/resend-invite
//
// Resends the supplier set-password email for an existing warehouse_users
// row. Used when the supplier loses / never received the original invite,
// or when an admin re-provisions a supplier whose link was previously
// removed.
//
// Generates a fresh recovery token via Supabase admin API (token_hash
// flow — survives email-client prefetch) and sends the branded Mailgun
// template that includes the warehouse context + role flags.

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendSupplierInviteEmail } from "@/lib/fulfillment/supplier-invite-email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const { id } = await ctx.params
  const service = createServiceRoleClient()

  // Load the warehouse_users row + warehouse + profile
  const { data: link, error: linkErr } = await service
    .from("warehouse_users")
    .select("id, user_id, warehouse_id, receives_po_emails, can_update_orders")
    .eq("id", id)
    .single()
  if (linkErr || !link) {
    return NextResponse.json({ error: "Warehouse user not found" }, { status: 404 })
  }

  const { data: warehouse } = await service
    .from("warehouses")
    .select("name, is_supplier_managed")
    .eq("id", (link as { warehouse_id: string }).warehouse_id)
    .single()
  const { data: profile } = await service
    .from("profiles")
    .select("email, contact_name, role")
    .eq("id", (link as { user_id: string }).user_id)
    .single()

  if (!warehouse || !profile) {
    return NextResponse.json(
      { error: "Linked warehouse or profile is missing" },
      { status: 500 },
    )
  }
  const role = (profile as { role: string }).role
  if (role !== "supplier" && role !== "admin") {
    return NextResponse.json(
      { error: `Cannot resend invite — user role is "${role}".` },
      { status: 400 },
    )
  }

  const email = (profile as { email: string }).email
  const contactName = (profile as { contact_name: string | null }).contact_name
  const warehouseName = (warehouse as { name: string }).name

  // Generate a fresh recovery token and embed it in our own URL so the
  // OTP isn't burned by email scanners.
  const { data: linkData, error: tokenErr } =
    await service.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${APP_URL}/reset-password` },
    })
  if (tokenErr) {
    console.warn(
      `[resend-invite] generateLink failed for ${email}: ${tokenErr.message}`,
    )
    return NextResponse.json(
      { error: `Could not generate set-password link: ${tokenErr.message}` },
      { status: 500 },
    )
  }
  const props = (linkData?.properties as
    | { hashed_token?: string; action_link?: string }
    | undefined) ?? {}
  let setPasswordLink: string | null = null
  if (props.hashed_token) {
    const url = new URL(`${APP_URL}/reset-password`)
    url.searchParams.set("token_hash", props.hashed_token)
    url.searchParams.set("type", "recovery")
    url.searchParams.set("email", email)
    setPasswordLink = url.toString()
  } else if (props.action_link) {
    setPasswordLink = props.action_link
  }
  if (!setPasswordLink) {
    return NextResponse.json(
      { error: "Could not generate a password-reset link" },
      { status: 500 },
    )
  }

  try {
    const ok = await sendSupplierInviteEmail({
      to: email,
      contactName,
      warehouseName,
      setPasswordLink,
      receivesPoEmails: (link as { receives_po_emails: boolean }).receives_po_emails,
      canUpdateOrders: (link as { can_update_orders: boolean }).can_update_orders,
    })
    if (!ok) {
      return NextResponse.json(
        { error: "Email send returned a non-OK response — check Mailgun logs." },
        { status: 502 },
      )
    }
    console.log(
      `[resend-invite] ${email} → invite resent for warehouse=${warehouseName}`,
    )
    return NextResponse.json({ ok: true, email })
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to send invite email",
      },
      { status: 500 },
    )
  }
}
