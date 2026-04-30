import { NextRequest, NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  checkAndRecordIpRate,
  extractIp,
  loadShareLinkBySlug,
} from "@/lib/reviews/share-links"
import { validateEmail } from "@/lib/reviews/disposable-emails"

/**
 * POST /api/reviews/share/submit
 *
 * Public submit endpoint for reviews coming via a share link. No auth,
 * but defended by:
 *   1. Per-IP rate limit (3 submissions / hour)
 *   2. Honeypot field ("website") - bots auto-fill, humans never see it
 *   3. Email format + disposable-domain blocklist
 *   4. Share-link active / not expired / not over max-uses checks
 *   5. Admin moderation queue (everything lands as 'pending')
 *
 * On submit the review row gets source='public_link', verified_buyer=false.
 * That second flag is what the product page uses to decide:
 *   - which badge to show on the card (verified vs reviewer)
 *   - whether the review counts toward the headline rating + JSON-LD
 *
 * Per Phase 2 spec: public-link reviews never affect the headline rating.
 */

export const maxDuration = 30

const NAME_FORMATS = [
  "first_initial",
  "initials",
  "anonymous_city",
  "role_state",
] as const
type NameFormat = (typeof NAME_FORMATS)[number]

interface SubmitBody {
  slug?: unknown
  nameFormat?: unknown
  firstName?: unknown
  lastInitial?: unknown
  role?: unknown
  city?: unknown
  state?: unknown
  email?: unknown
  companyOrRole?: unknown
  rating?: unknown
  headline?: unknown
  body?: unknown
  consent?: unknown
  /** Honeypot - any value here = silent reject. */
  website?: unknown
}

function isStr(v: unknown): v is string {
  return typeof v === "string"
}

function buildDisplayName(
  fmt: NameFormat,
  fields: {
    firstName?: string
    lastInitial?: string
    role?: string
    city?: string
    state?: string
  },
): string | null {
  switch (fmt) {
    case "first_initial":
      if (!fields.firstName) return null
      return fields.lastInitial
        ? `${fields.firstName} ${fields.lastInitial.charAt(0).toUpperCase()}.`
        : fields.firstName
    case "initials": {
      if (!fields.firstName) return null
      const f = fields.firstName.charAt(0).toUpperCase()
      const l = fields.lastInitial?.charAt(0).toUpperCase()
      return l ? `${f}. ${l}.` : `${f}.`
    }
    case "anonymous_city":
      if (!fields.city) return null
      return `Anonymous from ${fields.city}`
    case "role_state":
      if (!fields.role || !fields.state) return null
      return `${fields.role}, ${fields.state}`
  }
}

export async function POST(request: NextRequest) {
  let payload: SubmitBody
  try {
    payload = (await request.json()) as SubmitBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Honeypot: if the bot filled the trap, return a fake success without
  // inserting anything. We don't want bots to learn the field is a trap.
  if (typeof payload.website === "string" && payload.website.trim().length > 0) {
    return NextResponse.json({ id: "honeypot", status: "pending" }, { status: 201 })
  }

  if (!isStr(payload.slug) || !payload.slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 })
  }
  if (!isStr(payload.nameFormat) || !NAME_FORMATS.includes(payload.nameFormat as NameFormat)) {
    return NextResponse.json({ error: "Invalid nameFormat" }, { status: 400 })
  }
  const rating = Number(payload.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be 1-5" }, { status: 400 })
  }
  if (!isStr(payload.headline) || payload.headline.trim().length < 4) {
    return NextResponse.json(
      { error: "Headline is required (min 4 chars)" },
      { status: 400 },
    )
  }
  if (!isStr(payload.body) || payload.body.trim().length < 20) {
    return NextResponse.json(
      { error: "Review body must be at least 20 characters" },
      { status: 400 },
    )
  }
  if (payload.consent !== true) {
    return NextResponse.json(
      { error: "You must consent to publishing the review" },
      { status: 400 },
    )
  }
  if (!isStr(payload.email)) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }
  const emailError = validateEmail(payload.email)
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 })
  }
  if (!isStr(payload.companyOrRole) || payload.companyOrRole.trim().length < 2) {
    return NextResponse.json(
      { error: "Company / role is required" },
      { status: 400 },
    )
  }

  const nameFormat = payload.nameFormat as NameFormat
  const fields = {
    firstName: isStr(payload.firstName) ? payload.firstName.trim() : undefined,
    lastInitial: isStr(payload.lastInitial) ? payload.lastInitial.trim() : undefined,
    role: isStr(payload.role) ? payload.role.trim() : undefined,
    city: isStr(payload.city) ? payload.city.trim() : undefined,
    state: isStr(payload.state) ? payload.state.trim() : undefined,
  }
  const displayName = buildDisplayName(nameFormat, fields)
  if (!displayName) {
    return NextResponse.json(
      { error: "Missing required fields for the chosen name format" },
      { status: 400 },
    )
  }

  const service = createServiceRoleClient()

  // Validate the share link itself.
  const linkResult = await loadShareLinkBySlug(service, payload.slug)
  if (!linkResult.ok) {
    return NextResponse.json(
      { error: `Share link is no longer active (${linkResult.reason})` },
      { status: 410 },
    )
  }
  const link = linkResult.link

  // Per-IP rate limit (also records this attempt for the next call).
  const ip = extractIp(request.headers)
  const rate = await checkAndRecordIpRate(service, ip, link.id)
  if (!rate.withinLimit) {
    return NextResponse.json(
      { error: "Too many submissions from this network. Please try again later." },
      { status: 429 },
    )
  }

  // Insert the review. share_link_id ties the review back to its source
  // link so the admin "View submissions" filter on the Share links tab
  // can query directly without joining through the audit log.
  const { data: inserted, error: insertErr } = await service
    .from("reviews")
    .insert({
      product_id: link.product_id,
      order_id: null,
      token_id: null,
      share_link_id: link.id,
      source: "public_link",
      name_format: nameFormat,
      display_name: displayName,
      reviewer_city: fields.city ?? null,
      reviewer_state: fields.state ?? null,
      reviewer_role: nameFormat === "role_state" ? fields.role ?? null : null,
      rating,
      headline: payload.headline.trim(),
      body: payload.body.trim(),
      consent_given: true,
      verified_buyer: false,
    })
    .select("id")
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to insert review" },
      { status: 500 },
    )
  }

  // Increment used_count on the share link.
  await service
    .from("review_share_links")
    .update({ used_count: link.used_count + 1 })
    .eq("id", link.id)

  // Audit log.
  await service.from("review_audit_log").insert({
    review_id: inserted.id,
    product_id: link.product_id,
    action: "submitted",
    detail: {
      source: "public_link",
      share_link_id: link.id,
      share_link_slug: link.slug,
      name_format: nameFormat,
      rating,
      email: (payload.email as string).trim().toLowerCase(),
      company_or_role: (payload.companyOrRole as string).trim(),
    },
  })

  return NextResponse.json(
    { id: inserted.id, status: "pending" },
    { status: 201 },
  )
}
