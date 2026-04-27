/**
 * GET  /api/marketing/contacts      -- list contacts (paginated, searchable)
 * POST /api/marketing/contacts      -- create a single contact in GHL + mirror locally
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlContacts } from "@/lib/ghl"
import { mirrorGhlContact } from "@/lib/ghl/mirror"
import { normaliseAuPhone, normaliseEmail } from "@/lib/ghl/phone"

/**
 * Sanitise search input so it can safely be interpolated into a PostgREST
 * `.or()` filter. Strips chars that are special in PostgREST filter grammar:
 *   - `,` separates filter clauses
 *   - `%` is the ilike wildcard
 *   - `*` is historical PostgREST wildcard
 *   - `()`, `.` appear in operator syntax
 */
function sanitiseFilterInput(raw: string): string {
  return raw.replace(/[,%*().]/g, "").slice(0, 120)
}

export async function GET(request: NextRequest) {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  const searchParams = request.nextUrl.searchParams
  const q = sanitiseFilterInput(searchParams.get("q")?.trim() ?? "")
  // Accept both ?tag=X (legacy, single) and ?tags=X,Y,Z (multiple). Tags get
  // sanitised individually.
  const rawTags =
    searchParams.getAll("tags").length > 0
      ? searchParams.getAll("tags").flatMap((t) => t.split(","))
      : searchParams.get("tag")
        ? [searchParams.get("tag") as string]
        : []
  const tags = rawTags
    .map((t) => sanitiseFilterInput(t.trim()))
    .filter(Boolean)
  // tagMatchAll defaults to true (AND). Only set to false if explicitly ?tagMatchAll=false.
  const tagMatchAll = searchParams.get("tagMatchAll") !== "false"
  const state = sanitiseFilterInput(searchParams.get("state")?.trim() ?? "")
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200)
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1)

  const supabase = createServiceRoleClient()
  let query = supabase
    .from("marketing_contacts")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company_name.ilike.%${q}%`,
    )
  }
  if (tags.length > 0) {
    query = tagMatchAll
      ? query.contains("tags", tags)
      : query.overlaps("tags", tags)
  }
  if (state) {
    query = query.ilike("state", state)
  }

  const { data, error: dbError, count } = await query
  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({
    contacts: data ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}

const createContactSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  address1: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postal_code: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
})

export async function POST(request: NextRequest) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createContactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const input = parsed.data
  const email = normaliseEmail(input.email)
  const phone = normaliseAuPhone(input.phone)
  if (!email && !phone) {
    return NextResponse.json(
      { error: "Either email or phone is required" },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()

  try {
    const { contact: ghlContact } = await GhlContacts.upsertContact({
      email: email ?? undefined,
      phone: phone ?? undefined,
      firstName: input.first_name ?? undefined,
      lastName: input.last_name ?? undefined,
      companyName: input.company_name ?? undefined,
      address1: input.address1 ?? undefined,
      city: input.city ?? undefined,
      state: input.state ?? undefined,
      postalCode: input.postal_code ?? undefined,
      tags: input.tags ?? undefined,
      source: "ChemConnect Admin",
    })

    const { contactId } = await mirrorGhlContact(supabase, ghlContact, {
      source: "manual",
    })

    await supabase.from("marketing_audit_log").insert({
      actor_profile_id: user?.id ?? null,
      action: "contact.created_manual",
      target_type: "contact",
      target_id: contactId,
      meta: { ghl_contact_id: ghlContact.id },
    })

    return NextResponse.json({ contactId, ghlContactId: ghlContact.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
