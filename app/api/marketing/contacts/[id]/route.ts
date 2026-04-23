/**
 * GET    /api/marketing/contacts/[id] -- full profile + event timeline + SMS thread
 * PATCH  /api/marketing/contacts/[id] -- update local (syncs to GHL when relevant fields change)
 * DELETE /api/marketing/contacts/[id] -- delete in GHL + soft-delete locally
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlContacts } from "@/lib/ghl"
import { mirrorGhlContact } from "@/lib/ghl/mirror"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireMarketingRole("view")
  if (error) return error

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data: contact, error: dbError } = await supabase
    .from("marketing_contacts")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const pageSize = Math.min(
    Math.max(parseInt(url.searchParams.get("eventsSize") ?? "20", 10) || 20, 1),
    100,
  )
  const page = Math.max(parseInt(url.searchParams.get("eventsPage") ?? "1", 10) || 1, 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const [
    { data: events, count: eventsTotal },
    { data: conversation },
  ] = await Promise.all([
    supabase
      .from("marketing_events")
      .select("id, event_type, campaign_id, metadata, occurred_at", {
        count: "exact",
      })
      .eq("contact_id", id)
      .order("occurred_at", { ascending: false })
      .range(from, to),
    supabase
      .from("sms_conversations")
      .select("id, unread_count, last_message_at, last_message_preview, last_message_direction")
      .eq("contact_id", id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    contact,
    events: events ?? [],
    eventsPagination: {
      page,
      pageSize,
      total: eventsTotal ?? 0,
      totalPages: Math.max(1, Math.ceil((eventsTotal ?? 0) / pageSize)),
    },
    conversation,
  })
}

const patchSchema = z.object({
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
})

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error

  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const { data: existing, error: fetchError } = await supabase
    .from("marketing_contacts")
    .select("ghl_contact_id")
    .eq("id", id)
    .maybeSingle()
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!existing?.ghl_contact_id) {
    return NextResponse.json(
      { error: "Contact has no linked GHL id" },
      { status: 400 },
    )
  }

  try {
    const updated = await GhlContacts.updateContact(existing.ghl_contact_id, {
      firstName: parsed.data.first_name ?? undefined,
      lastName: parsed.data.last_name ?? undefined,
      companyName: parsed.data.company_name ?? undefined,
      state: parsed.data.state ?? undefined,
      tags: parsed.data.tags ?? undefined,
    })
    const { contactId } = await mirrorGhlContact(supabase, updated, {
      source: "manual",
    })
    await supabase.from("marketing_audit_log").insert({
      actor_profile_id: user?.id ?? null,
      action: "contact.updated",
      target_type: "contact",
      target_id: contactId,
      meta: { fields: Object.keys(parsed.data) },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("delete")
  if (error) return error

  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data: existing, error: fetchError } = await supabase
    .from("marketing_contacts")
    .select("ghl_contact_id")
    .eq("id", id)
    .maybeSingle()
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  }

  try {
    if (existing.ghl_contact_id) {
      await GhlContacts.deleteContact(existing.ghl_contact_id)
    }
    await supabase
      .from("marketing_contacts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)

    await supabase.from("marketing_audit_log").insert({
      actor_profile_id: user?.id ?? null,
      action: "contact.deleted",
      target_type: "contact",
      target_id: id,
      meta: {},
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
