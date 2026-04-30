import { NextRequest, NextResponse } from "next/server"

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { consumeToken, validateToken } from "@/lib/reviews/tokens"

/**
 * POST /api/reviews/submit
 *
 * Body (JSON):
 * {
 *   token: string,
 *   nameFormat: 'first_initial' | 'initials' | 'anonymous_city' | 'role_state',
 *   firstName?: string,
 *   lastInitial?: string,
 *   role?: string,                  // when nameFormat = role_state
 *   city?: string,
 *   state?: string,
 *   rating: 1 | 2 | 3 | 4 | 5,
 *   headline: string,
 *   body: string,
 *   consent: true,
 *   photos?: { storagePath: string; publicUrl: string }[]
 * }
 *
 * On success:
 *   - inserts a row in `reviews` with status='pending'
 *   - inserts photo rows in `review_photos` (cap at 3)
 *   - flips review_tokens.consumed_at = now()
 *   - logs an audit_log entry (action='submitted')
 *   - returns 201 with the review id
 */

export const maxDuration = 30

interface SubmitBody {
  token?: unknown
  nameFormat?: unknown
  firstName?: unknown
  lastInitial?: unknown
  role?: unknown
  city?: unknown
  state?: unknown
  rating?: unknown
  headline?: unknown
  body?: unknown
  consent?: unknown
  photos?: unknown
}

const NAME_FORMATS = [
  "first_initial",
  "initials",
  "anonymous_city",
  "role_state",
] as const

type NameFormat = (typeof NAME_FORMATS)[number]

function isStr(v: unknown): v is string {
  return typeof v === "string"
}

function buildDisplayName(
  fmt: NameFormat,
  fields: { firstName?: string; lastInitial?: string; role?: string; city?: string; state?: string },
): string | null {
  switch (fmt) {
    case "first_initial": {
      if (!fields.firstName) return null
      return fields.lastInitial
        ? `${fields.firstName} ${fields.lastInitial.charAt(0).toUpperCase()}.`
        : fields.firstName
    }
    case "initials": {
      if (!fields.firstName) return null
      const f = fields.firstName.charAt(0).toUpperCase()
      const l = fields.lastInitial?.charAt(0).toUpperCase()
      return l ? `${f}. ${l}.` : `${f}.`
    }
    case "anonymous_city": {
      if (!fields.city) return null
      return `Anonymous from ${fields.city}`
    }
    case "role_state": {
      if (!fields.role || !fields.state) return null
      return `${fields.role}, ${fields.state}`
    }
  }
}

export async function POST(request: NextRequest) {
  let payload: SubmitBody
  try {
    payload = (await request.json()) as SubmitBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Required fields
  if (!isStr(payload.token)) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 })
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

  // Photos array — accept the {storagePath, publicUrl} shape produced by
  // /api/reviews/upload. Cap at 3.
  const photos = Array.isArray(payload.photos)
    ? (payload.photos as { storagePath?: unknown; publicUrl?: unknown }[])
        .filter(
          (p) => p && isStr(p.storagePath) && isStr(p.publicUrl),
        )
        .slice(0, 3)
    : []

  const supabase = createServiceRoleClient()

  // Validate token + DB state. validateToken increments attempt_count and
  // returns rate-limited / expired / consumed errors.
  const validation = await validateToken(supabase, payload.token)
  if (!validation.ok) {
    const status =
      validation.error === "rate_limited"
        ? 429
        : validation.error === "invalid_signature" || validation.error === "not_found"
        ? 401
        : 400
    return NextResponse.json({ error: validation.error }, { status })
  }

  const { tokenRowId, orderId, productId } = validation.data

  // Insert the review (status defaults to pending)
  const { data: inserted, error: insertErr } = await supabase
    .from("reviews")
    .insert({
      product_id: productId,
      order_id: orderId,
      token_id: tokenRowId,
      source: "magic_link",
      name_format: nameFormat,
      display_name: displayName,
      reviewer_city: fields.city ?? null,
      reviewer_state: fields.state ?? null,
      reviewer_role: nameFormat === "role_state" ? fields.role ?? null : null,
      rating,
      headline: payload.headline.trim(),
      body: payload.body.trim(),
      consent_given: true,
    })
    .select("id")
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to insert review" },
      { status: 500 },
    )
  }

  // Persist photo rows
  if (photos.length > 0) {
    const rows = photos.map((p, idx) => ({
      review_id: inserted.id,
      storage_path: p.storagePath as string,
      public_url: p.publicUrl as string,
      position: idx + 1,
    }))
    const { error: photoErr } = await supabase.from("review_photos").insert(rows)
    if (photoErr) {
      console.error("Photo insert error:", photoErr.message)
      // Non-fatal — review is in. Just log.
    }
  }

  // Burn the token
  await consumeToken(supabase, tokenRowId)

  // Audit
  await supabase.from("review_audit_log").insert({
    review_id: inserted.id,
    product_id: productId,
    action: "submitted",
    detail: { name_format: nameFormat, rating, photo_count: photos.length },
  })

  return NextResponse.json(
    { id: inserted.id, status: "pending" },
    { status: 201 },
  )
}
