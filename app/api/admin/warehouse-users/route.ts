// Warehouse users — supplier account management.
//
// Supplier accounts are deliberately distinct from buyer accounts. The
// rules, in order:
//
//   1. If the email already belongs to a customer / marketing_* user
//      we REJECT with 409. Suppliers need a dedicated email.
//   2. If the email already belongs to a supplier we LINK them to this
//      additional warehouse (multi-warehouse supplier). No new account.
//   3. If the email already belongs to an admin we LINK them (admin
//      overlap is allowed — used for ops/testing).
//   4. If the email is brand new we CREATE a fresh auth user with
//      role='supplier' from day 1 via Supabase's admin invite flow,
//      which both creates the user and emails them a link to set
//      their password.
//
// Roll-back contract: if step 4 succeeds but the warehouse_users insert
// fails, we delete the orphan auth user so admin can retry without a
// dead account in the system.

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendSupplierInviteEmail } from "@/lib/fulfillment/supplier-invite-email"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

type ResolveOutcome =
  | { kind: "rejected_role"; role: string; orderCount?: number }
  | { kind: "rejected_buyer_history"; role: string; orderCount: number }
  | {
      kind: "linked_existing"
      userId: string
      role: "supplier" | "admin"
      /** existing warehouse_users count BEFORE this add. 0 means the
       *  supplier was previously de-provisioned (admin removed every
       *  link) and we should send a fresh invite. */
      activeLinkCount: number
    }
  | {
      kind: "created_new"
      userId: string
      setPasswordLink: string | null
    }

// ---------------------------------------------------------------------
// GET — list warehouse users (with profile data)
// ---------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const warehouseId = request.nextUrl.searchParams.get("warehouse_id")

  let q = supabase
    .from("warehouse_users")
    .select(
      "id, warehouse_id, user_id, receives_po_emails, can_update_orders, is_primary_contact, created_at",
    )
    .order("created_at", { ascending: true })
  if (warehouseId) q = q.eq("warehouse_id", warehouseId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  if (rows.length === 0) return NextResponse.json([])

  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, contact_name, phone, role")
    .in("id", userIds)
  const profileMap = new Map(
    (profiles ?? []).map(
      (p: {
        id: string
        email: string
        contact_name: string | null
        phone: string | null
        role: string
      }) => [p.id, p],
    ),
  )

  const enriched = rows.map((r) => ({
    ...r,
    profiles: profileMap.get(r.user_id) ?? null,
  }))
  return NextResponse.json(enriched)
}

// ---------------------------------------------------------------------
// POST — create / link a supplier user to a warehouse
// ---------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const warehouseId = body.warehouse_id as string | undefined
  const rawEmail = body.email as string | undefined
  const email = rawEmail?.trim().toLowerCase()
  const contactName = (body.contact_name as string | undefined)?.trim() || null
  const phone = (body.phone as string | undefined)?.trim() || null
  const receivesPoEmails = body.receives_po_emails ?? true
  const canUpdateOrders = body.can_update_orders ?? true
  const isPrimaryContact = body.is_primary_contact ?? false

  if (!warehouseId) {
    return NextResponse.json({ error: "warehouse_id is required" }, { status: 400 })
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 },
    )
  }

  const service = createServiceRoleClient()

  // ---- Verify the warehouse exists and is supplier-managed ---------
  const { data: warehouse, error: whErr } = await service
    .from("warehouses")
    .select("id, name, is_supplier_managed")
    .eq("id", warehouseId)
    .single()
  if (whErr || !warehouse) {
    return NextResponse.json({ error: "Warehouse not found" }, { status: 404 })
  }
  if (!(warehouse as { is_supplier_managed: boolean }).is_supplier_managed) {
    return NextResponse.json(
      {
        error:
          "This warehouse is not flagged as supplier-managed. Toggle it on first via Warehouses → Edit.",
      },
      { status: 400 },
    )
  }

  // ---- Resolve email → user_id, applying role rules ----------------
  const outcome = await resolveOrCreateSupplierUser(service, {
    email,
    contactName,
    phone,
  })

  if (outcome.kind === "rejected_role") {
    return NextResponse.json(
      {
        error: `${email} is already registered as a "${outcome.role}". Suppliers need a dedicated business email — please ask the supplier to use a different address.`,
        existing_role: outcome.role,
      },
      { status: 409 },
    )
  }
  if (outcome.kind === "rejected_buyer_history") {
    return NextResponse.json(
      {
        error: `${email} is a buyer on Chem Connect (${outcome.orderCount} order${outcome.orderCount === 1 ? "" : "s"} on record). The same email cannot be both a buyer and a supplier, please ask the supplier to use a different business email.`,
        existing_role: outcome.role,
        order_count: outcome.orderCount,
      },
      { status: 409 },
    )
  }

  const userId =
    outcome.kind === "linked_existing" ? outcome.userId : outcome.userId

  // ---- Reject duplicate (warehouse_id, user_id) link ---------------
  const { data: dupe } = await service
    .from("warehouse_users")
    .select("id")
    .eq("warehouse_id", warehouseId)
    .eq("user_id", userId)
    .maybeSingle()
  if (dupe) {
    return NextResponse.json(
      { error: `${email} is already linked to this warehouse.` },
      { status: 409 },
    )
  }

  // ---- Insert warehouse_users row ----------------------------------
  const { data: link, error: linkErr } = await service
    .from("warehouse_users")
    .insert({
      warehouse_id: warehouseId,
      user_id: userId,
      receives_po_emails: receivesPoEmails,
      can_update_orders: canUpdateOrders,
      is_primary_contact: isPrimaryContact,
    })
    .select()
    .single()

  if (linkErr || !link) {
    // Roll back the orphan auth user if we just created one.
    if (outcome.kind === "created_new") {
      await service.auth.admin.deleteUser(userId).catch(() => {})
    }
    return NextResponse.json(
      { error: linkErr?.message ?? "Failed to link user to warehouse" },
      { status: 500 },
    )
  }

  // ---- Send our own branded invite email (Mailgun, not Supabase) ---
  // Done after the warehouse_users link succeeds so we can include the
  // warehouse name + role flags in the email.
  //
  // Triggers:
  //   - created_new: brand-new supplier account → always send invite
  //   - linked_existing supplier with 0 prior links: previously
  //     de-provisioned supplier being re-onboarded → re-send invite so
  //     they get a fresh set-password link
  //   - linked_existing supplier with N prior links: just adding to
  //     another warehouse — don't spam them, they already have access
  let invite_sent = false
  let invite_error: string | null = null
  const created_new_account = outcome.kind === "created_new"
  const linked_existing_role =
    outcome.kind === "linked_existing" ? outcome.role : null

  const shouldSendInvite =
    created_new_account ||
    (outcome.kind === "linked_existing" &&
      outcome.role === "supplier" &&
      outcome.activeLinkCount === 0)

  if (shouldSendInvite) {
    let setPasswordLink: string | null = null
    if (outcome.kind === "created_new") {
      setPasswordLink = outcome.setPasswordLink
    } else {
      // Linked-existing supplier being re-onboarded — generate a fresh
      // password-reset link so they can sign in again.
      setPasswordLink = await generateSetPasswordLink(service, email)
    }

    if (setPasswordLink) {
      try {
        const ok = await sendSupplierInviteEmail({
          to: email,
          contactName,
          warehouseName: (warehouse as { name: string }).name,
          setPasswordLink,
          receivesPoEmails,
          canUpdateOrders,
        })
        invite_sent = ok
        if (!ok) invite_error = "Mailgun returned a non-OK response"
      } catch (err) {
        invite_error = err instanceof Error ? err.message : "Email send failed"
      }
    } else {
      invite_error = "Could not generate a password-reset link"
    }
  }

  console.log(
    `[warehouse-users] ${email} → ${outcome.kind} (warehouse=${
      (warehouse as { name: string }).name
    }, invite_sent=${invite_sent}${invite_error ? `, error=${invite_error}` : ""})`,
  )

  return NextResponse.json(
    {
      ...link,
      email,
      created_new_account,
      invite_sent,
      invite_error,
      linked_existing_role,
    },
    { status: 201 },
  )
}

// ---------------------------------------------------------------------
// DELETE — unlink a user from a warehouse (does NOT delete the account)
// ---------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { error } = await supabase.from("warehouse_users").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
async function resolveOrCreateSupplierUser(
  service: ReturnType<typeof createServiceRoleClient>,
  args: { email: string; contactName: string | null; phone: string | null },
): Promise<ResolveOutcome> {
  const { email, contactName, phone } = args

  // Source of truth is auth.users — profile rows can be deleted manually
  // by admins, leaving orphan auth users that block re-creation by email.
  // We resolve via auth.users FIRST, then look up / repair the profile.
  const authUser = await findAuthUserByEmail(service, email)

  if (authUser) {
    const userId = authUser.id
    const { data: profile } = await service
      .from("profiles")
      .select("id, email, role, contact_name, phone")
      .eq("id", userId)
      .maybeSingle()

    // Buyer-history is the ground truth — applies regardless of current
    // role and even if the profile row is missing entirely (the orders
    // table doesn't cascade on profile delete).
    const { count: orderCount } = await service
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    const orders = orderCount ?? 0

    const role = (profile as { role: string } | null)?.role ?? null

    if (role !== "admin" && orders > 0) {
      console.log(
        `[warehouse-users] resolve(${email}): rejected — has ${orders} order(s) (role=${role ?? "no profile"})`,
      )
      return {
        kind: "rejected_buyer_history",
        role: role ?? "customer",
        orderCount: orders,
      }
    }

    if (profile) {
      // Count existing warehouse_users links so the caller can decide
      // whether to auto-resend an invite (0 active links = previously
      // de-provisioned supplier being re-onboarded).
      const { count: activeLinkCount } = await service
        .from("warehouse_users")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)

      console.log(
        `[warehouse-users] resolve(${email}): existing profile id=${userId}, role=${role}, active_links=${activeLinkCount ?? 0}`,
      )
      if (role === "supplier" || role === "admin") {
        return {
          kind: "linked_existing",
          userId,
          role: role as "supplier" | "admin",
          activeLinkCount: activeLinkCount ?? 0,
        }
      }
      // Customer / marketing without orders — still a hard reject.
      return { kind: "rejected_role", role: role ?? "unknown" }
    }

    // ---- Orphan case: auth.users row exists but profile was deleted.
    // No orders on record (else we'd have rejected above), so admin
    // clearly wanted a clean slate. Re-create the profile with role
    // 'supplier' and proceed as a brand-new supplier account. We also
    // re-issue the set-password link so the supplier can sign in.
    console.log(
      `[warehouse-users] resolve(${email}): orphan auth user ${userId} (no profile) — repairing as supplier`,
    )
    const { error: insertErr } = await service.from("profiles").insert({
      id: userId,
      email,
      role: "supplier",
      contact_name: contactName,
      phone,
    })
    if (insertErr) {
      // Last-ditch fallback: try update instead in case the trigger
      // re-created the row racy-style.
      const { error: updErr } = await service
        .from("profiles")
        .update({
          email,
          role: "supplier",
          contact_name: contactName,
          phone,
        })
        .eq("id", userId)
      if (updErr) {
        throw new Error(
          `Failed to repair profile for orphan auth user: ${insertErr.message}`,
        )
      }
    }

    return {
      kind: "created_new",
      userId,
      setPasswordLink: await generateSetPasswordLink(service, email),
    }
  }

  console.log(`[warehouse-users] resolve(${email}): no auth user — will create`)

  // ---- Brand-new account ---------------------------------------
  // 1. createUser with email_confirm:true (no Supabase email)
  // 2. generateLink type:'recovery' to get a set-password URL
  // 3. The caller (POST handler) sends our branded Mailgun email
  //    containing the link. We never use Supabase's built-in templates.
  const { data: created, error: createErr } =
    await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        role: "supplier",
        contact_name: contactName,
        phone,
      },
    })
  if (createErr || !created?.user) {
    throw new Error(
      `Failed to create supplier account: ${createErr?.message ?? "unknown error"}`,
    )
  }
  const userId = created.user.id

  // The handle_new_user trigger created a profile with role='customer'
  // (it only special-cases 'admin' in metadata). Force role + extras.
  const { error: profileErr } = await service
    .from("profiles")
    .update({
      role: "supplier",
      contact_name: contactName,
      phone,
    })
    .eq("id", userId)
  if (profileErr) {
    await service.auth.admin.deleteUser(userId).catch(() => {})
    throw new Error(
      `Failed to set supplier role on profile: ${profileErr.message}`,
    )
  }

  return {
    kind: "created_new",
    userId,
    setPasswordLink: await generateSetPasswordLink(service, email),
  }
}

// Returns the auth.users row whose email matches case-insensitively, or
// null. Uses paginated listUsers since the admin SDK doesn't expose a
// direct getUserByEmail. Bails after MAX_PAGES (large enough for any
// realistic install).
async function findAuthUserByEmail(
  service: ReturnType<typeof createServiceRoleClient>,
  email: string,
): Promise<{ id: string; email: string } | null> {
  const lower = email.toLowerCase()
  const PER_PAGE = 1000
  const MAX_PAGES = 50 // 50,000 users — well past anything in scope here
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    })
    if (error) {
      console.warn(
        `[warehouse-users] listUsers page ${page} failed: ${error.message}`,
      )
      return null
    }
    const users = data?.users ?? []
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === lower)
    if (hit) return { id: hit.id, email: hit.email ?? email }
    if (users.length < PER_PAGE) return null
  }
  console.warn(
    `[warehouse-users] findAuthUserByEmail(${email}): exhausted ${MAX_PAGES} pages without a match`,
  )
  return null
}

async function generateSetPasswordLink(
  service: ReturnType<typeof createServiceRoleClient>,
  email: string,
): Promise<string | null> {
  // We deliberately do NOT use the action_link Supabase returns. Email
  // clients (Gmail/Outlook) prefetch links as a security scan, which
  // consumes the one-time OTP before the recipient clicks. By the time
  // the supplier opens the email, the link is already burned and they
  // hit "otp_expired".
  //
  // Instead we extract the token_hash and embed it in our own URL. The
  // reset-password page calls supabase.auth.verifyOtp({ token_hash,
  // type: 'recovery' }) only on form submit — prefetchers never trigger
  // the verification, so the token survives until the human clicks.
  const { data, error } = await service.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${APP_URL}/reset-password` },
  })
  if (error) {
    console.warn(
      `[warehouse-users] generateLink failed for ${email}: ${error.message}`,
    )
    return null
  }
  const props = (data?.properties as
    | { hashed_token?: string; action_link?: string }
    | undefined) ?? {}
  if (!props.hashed_token) {
    // Fallback: if Supabase didn't return hashed_token (unexpected),
    // use the action_link so we don't fully fail. Prefetch issue may
    // still occur but at least the link works once.
    return props.action_link ?? null
  }
  const url = new URL(`${APP_URL}/reset-password`)
  url.searchParams.set("token_hash", props.hashed_token)
  url.searchParams.set("type", "recovery")
  url.searchParams.set("email", email)
  return url.toString()
}
