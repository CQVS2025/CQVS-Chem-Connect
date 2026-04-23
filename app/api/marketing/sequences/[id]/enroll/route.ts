/**
 * POST /api/marketing/sequences/[id]/enroll
 *
 * Body: { contactId: uuid }  // LOCAL marketing_contacts id
 *
 * Looks up the ghl_contact_id, calls GHL workflow enrol, logs to audit.
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlWorkflows } from "@/lib/ghl"

interface RouteParams {
  params: Promise<{ id: string }>
}

const bodySchema = z.object({
  contactId: z.string().uuid(),
})

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error
  const { id: workflowId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const { data: contact } = await supabase
    .from("marketing_contacts")
    .select("ghl_contact_id, is_opted_out, full_name")
    .eq("id", parsed.data.contactId)
    .maybeSingle()

  if (!contact?.ghl_contact_id) {
    return NextResponse.json(
      { error: "Contact not linked to GHL" },
      { status: 400 },
    )
  }
  if (contact.is_opted_out) {
    return NextResponse.json(
      { error: "Contact is opted out" },
      { status: 400 },
    )
  }

  try {
    await GhlWorkflows.enrollContact(contact.ghl_contact_id, workflowId)
    await supabase.from("marketing_audit_log").insert({
      actor_profile_id: user?.id ?? null,
      action: "sequence.enrolled",
      target_type: "contact",
      target_id: parsed.data.contactId,
      meta: { workflow_id: workflowId, ghl_contact_id: contact.ghl_contact_id },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error
  const { id: workflowId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()
  const { data: contact } = await supabase
    .from("marketing_contacts")
    .select("ghl_contact_id")
    .eq("id", parsed.data.contactId)
    .maybeSingle()
  if (!contact?.ghl_contact_id) {
    return NextResponse.json({ error: "Contact not linked to GHL" }, { status: 400 })
  }

  try {
    await GhlWorkflows.unenrollContact(contact.ghl_contact_id, workflowId)
    await supabase.from("marketing_audit_log").insert({
      actor_profile_id: user?.id ?? null,
      action: "sequence.unenrolled",
      target_type: "contact",
      target_id: parsed.data.contactId,
      meta: { workflow_id: workflowId },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
