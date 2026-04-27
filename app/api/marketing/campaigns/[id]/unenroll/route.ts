/**
 * POST /api/marketing/campaigns/[id]/unenroll
 *
 * Removes one or more contacts from the GHL workflow this campaign enrolled
 * them into. Only valid for campaigns of type `ghl_workflow`.
 *
 * Body:
 *   { "contactIds": ["uuid", ...] }   - local marketing_contacts IDs
 *   { "all": true }                    - remove every contact still enrolled
 *                                        (derived from marketing_events)
 *
 * Effects in GHL:
 *   - DELETE /contacts/{contactId}/workflow/{workflowId}
 *   - Contact exits the active workflow run; already-sent emails stay sent;
 *     queued / future steps (waits, branches, further emails) are cancelled.
 *
 * Effects locally:
 *   - Writes a `workflow_unenrolled` event per contact (idempotent-ish: we
 *     don't re-write if the contact is already in the unenrolled state for
 *     this campaign, to avoid double-decrementing).
 *   - Decrements enrolled_count, increments unenrolled_count on the campaign.
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlWorkflows } from "@/lib/ghl"
import { GHLApiError } from "@/lib/ghl/errors"

// Paces GHL DELETE calls the same way the dispatcher paces enrolments.
const CONCURRENCY = 6
const BATCH_PAUSE_MS = 50

// Safety cap so a runaway "all" never tries to unenrol thousands of people
// in a single request (serverless timeout risk). If we ever hit this, split
// into multiple calls client-side.
const MAX_PER_REQUEST = 500

// Large bulks need the full Vercel Pro budget.
export const maxDuration = 60

const bodySchema = z.union([
  z.object({ contactIds: z.array(z.string().uuid()).min(1).max(MAX_PER_REQUEST) }),
  z.object({ all: z.literal(true) }),
])

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { error, user } = await requireMarketingRole("edit")
  if (error) return error
  const { id } = await params

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

  const { data: campaign } = await supabase
    .from("marketing_campaigns")
    .select("id, type, ghl_workflow_id, ghl_workflow_name, enrolled_count, unenrolled_count")
    .eq("id", id)
    .maybeSingle()
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }
  if (campaign.type !== "ghl_workflow") {
    return NextResponse.json(
      { error: "Only GHL workflow campaigns can be unenrolled" },
      { status: 400 },
    )
  }
  if (!campaign.ghl_workflow_id) {
    return NextResponse.json(
      { error: "Campaign has no workflow reference" },
      { status: 400 },
    )
  }
  const workflowId = campaign.ghl_workflow_id

  // Resolve the target contact list. For `{all: true}` we pull every contact
  // that has a workflow_enrolled event for this campaign but NOT a later
  // workflow_unenrolled event (SQL below). For explicit IDs we just use them.
  let targetContactIds: string[]
  if ("all" in parsed.data) {
    const { data: stillEnrolled, error: rpcError } = await supabase.rpc(
      "still_enrolled_contacts",
      { p_campaign_id: id },
    )
    if (rpcError) {
      // Fallback to direct query if RPC doesn't exist yet (migration not
      // applied). Query events and filter client-side so this route keeps
      // working even without the helper function.
      const { data: events } = await supabase
        .from("marketing_events")
        .select("contact_id, event_type, occurred_at")
        .eq("campaign_id", id)
        .in("event_type", ["workflow_enrolled", "workflow_unenrolled"])
        .order("occurred_at", { ascending: false })
      const latestByContact = new Map<string, string>()
      for (const ev of events ?? []) {
        if (!ev.contact_id) continue
        if (!latestByContact.has(ev.contact_id)) {
          latestByContact.set(ev.contact_id, ev.event_type)
        }
      }
      targetContactIds = [...latestByContact.entries()]
        .filter(([, evt]) => evt === "workflow_enrolled")
        .map(([cid]) => cid)
        .slice(0, MAX_PER_REQUEST)
    } else {
      targetContactIds = ((stillEnrolled as Array<{ contact_id: string }>) ?? [])
        .map((r) => r.contact_id)
        .slice(0, MAX_PER_REQUEST)
    }
  } else {
    targetContactIds = parsed.data.contactIds
  }

  if (targetContactIds.length === 0) {
    return NextResponse.json({
      succeeded: 0,
      failed: 0,
      skipped: 0,
      message: "No contacts to unenrol",
    })
  }

  // Load the target contacts' GHL IDs in one round-trip.
  const { data: contacts } = await supabase
    .from("marketing_contacts")
    .select("id, ghl_contact_id, full_name, email")
    .in("id", targetContactIds)
  const contactMap = new Map(
    (contacts ?? []).map((c) => [c.id, c] as const),
  )

  let succeeded = 0
  let failed = 0
  let skipped = 0
  const errors: Array<{ contactId: string; error: string }> = []

  for (let i = 0; i < targetContactIds.length; i += CONCURRENCY) {
    const batch = targetContactIds.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (localId) => {
        const contact = contactMap.get(localId)
        if (!contact?.ghl_contact_id) {
          return { localId, status: "skipped" as const, reason: "not linked to GHL" }
        }
        try {
          await GhlWorkflows.unenrollContact(contact.ghl_contact_id, workflowId)
          await supabase.from("marketing_events").insert({
            ghl_event_id: `unenrol-${id}-${localId}-${Date.now()}`,
            event_type: "workflow_unenrolled",
            campaign_id: id,
            contact_id: localId,
            ghl_contact_id: contact.ghl_contact_id,
            metadata: {
              workflow_id: workflowId,
              workflow_name: campaign.ghl_workflow_name ?? null,
              removed_by: user?.id ?? null,
            },
            occurred_at: new Date().toISOString(),
          })
          return { localId, status: "ok" as const }
        } catch (err) {
          // GHL returns 404 if the contact isn't actually in the workflow
          // (e.g. already finished, or already unenrolled). Treat that as a
          // successful no-op - the end state is what we wanted.
          if (err instanceof GHLApiError && err.status === 404) {
            return { localId, status: "skipped" as const, reason: "already not enrolled" }
          }
          const msg = err instanceof Error ? err.message : String(err)
          return { localId, status: "error" as const, error: msg }
        }
      }),
    )
    for (const r of results) {
      if (r.status === "ok") succeeded += 1
      else if (r.status === "skipped") skipped += 1
      else {
        failed += 1
        errors.push({ contactId: r.localId, error: r.error })
      }
    }
    if (i + CONCURRENCY < targetContactIds.length) {
      await sleep(BATCH_PAUSE_MS)
    }
  }

  // Update counters atomically-ish. enrolled_count can't go below 0 - if the
  // current value is somehow lower than `succeeded` (manual DB edit, stale
  // counter) we clamp to 0 instead of producing a negative tally.
  if (succeeded > 0) {
    const newEnrolled = Math.max(0, (campaign.enrolled_count ?? 0) - succeeded)
    const newUnenrolled = (campaign.unenrolled_count ?? 0) + succeeded
    await supabase
      .from("marketing_campaigns")
      .update({
        enrolled_count: newEnrolled,
        unenrolled_count: newUnenrolled,
      })
      .eq("id", id)
  }

  await supabase.from("marketing_audit_log").insert({
    actor_profile_id: user?.id ?? null,
    action: "campaign.unenrolled",
    target_type: "campaign",
    target_id: id,
    meta: {
      workflow_id: workflowId,
      requested: targetContactIds.length,
      succeeded,
      failed,
      skipped,
    },
  })

  return NextResponse.json({
    campaignId: id,
    requested: targetContactIds.length,
    succeeded,
    failed,
    skipped,
    errors: errors.slice(0, 20),
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
