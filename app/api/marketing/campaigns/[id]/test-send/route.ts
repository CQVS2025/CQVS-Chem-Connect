/**
 * POST /api/marketing/campaigns/[id]/test-send
 *
 * Sends the campaign to a single test recipient (by email or GHL contact id)
 * without flipping the campaign status. Useful to eyeball a draft in a real
 * inbox before hitting the big Send button.
 */

import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import { requireMarketingRole } from "@/lib/supabase/marketing-role-check"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { GhlCampaigns, GhlConversations, GhlWorkflows } from "@/lib/ghl"
import { GHLApiError } from "@/lib/ghl/errors"
import { substituteMergeTags } from "@/lib/marketing/merge-tags"

export const maxDuration = 30

const bodySchema = z.object({
  contactId: z.string().min(1),
})

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
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: contact } = await supabase
    .from("marketing_contacts")
    .select(
      "ghl_contact_id, email, phone, first_name, last_name, full_name, company_name, state, country",
    )
    .eq("id", parsed.data.contactId)
    .maybeSingle()
  if (!contact?.ghl_contact_id) {
    return NextResponse.json({ error: "Contact not linked to GHL" }, { status: 400 })
  }

  // Apply merge-tag substitution so the test inbox receives the
  // personalised version of the email rather than the literal {{tags}}.
  const mergeCtx = {
    first_name: contact.first_name,
    last_name: contact.last_name,
    full_name: contact.full_name,
    email: contact.email,
    phone: contact.phone,
    company_name: contact.company_name,
    state: contact.state,
    country: contact.country,
  }

  try {
    if (campaign.type === "email") {
      if (!campaign.subject || !campaign.body_html) {
        return NextResponse.json(
          { error: "Email campaign is missing subject or body_html" },
          { status: 400 },
        )
      }
      const res = await GhlCampaigns.sendEmailMessage({
        contactId: contact.ghl_contact_id,
        subject: `[TEST] ${substituteMergeTags(campaign.subject, mergeCtx)}`,
        html: substituteMergeTags(campaign.body_html, mergeCtx, {
          escapeHtml: true,
        }),
        fromEmail: campaign.from_email ?? undefined,
        fromName: campaign.from_name ?? undefined,
        replyTo: campaign.reply_to ?? undefined,
      })
      // Attribution anchor so LCEmailStats events (opens/clicks from this
      // test email) resolve to *this* campaign instead of the most-recent
      // anchor for the same recipient. The `is_test: true` flag tells the
      // webhook handler to skip counter bumps - we want attribution without
      // inflating the real campaign metrics before the actual send.
      await supabase.from("marketing_events").upsert(
        {
          ghl_event_id: `sent-${res.messageId}`,
          event_type: "delivered",
          campaign_id: id,
          contact_id: parsed.data.contactId,
          ghl_contact_id: contact.ghl_contact_id,
          metadata: {
            message_id: res.messageId,
            email_message_id: res.emailMessageId,
            recipient_email: contact.email,
            attribution_anchor: true,
            is_test: true,
          },
          occurred_at: new Date().toISOString(),
        },
        { onConflict: "ghl_event_id", ignoreDuplicates: true },
      )
      await supabase.from("marketing_audit_log").insert({
        actor_profile_id: user?.id ?? null,
        action: "campaign.test_sent",
        target_type: "campaign",
        target_id: id,
        meta: { channel: "email", to_contact: parsed.data.contactId, message_id: res.messageId },
      })
      return NextResponse.json({ ok: true, messageId: res.messageId })
    }

    if (campaign.type === "sms") {
      if (!campaign.body_text) {
        return NextResponse.json(
          { error: "SMS campaign is missing body_text" },
          { status: 400 },
        )
      }
      const res = await GhlConversations.sendSmsMessage({
        contactId: contact.ghl_contact_id,
        message: `[TEST] ${substituteMergeTags(campaign.body_text, mergeCtx)}`,
      })
      await supabase.from("marketing_audit_log").insert({
        actor_profile_id: user?.id ?? null,
        action: "campaign.test_sent",
        target_type: "campaign",
        target_id: id,
        meta: { channel: "sms", to_contact: parsed.data.contactId, message_id: res.messageId },
      })
      return NextResponse.json({ ok: true, messageId: res.messageId })
    }

    if (campaign.type === "ghl_workflow") {
      if (!campaign.ghl_workflow_id) {
        return NextResponse.json(
          { error: "Workflow campaign is missing a GHL workflow selection" },
          { status: 400 },
        )
      }
      // "Test" for a workflow = enrol just this one contact. There's no
      // [TEST] prefix to apply - workflow emails are authored in GHL - so the
      // test is functionally a real enrolment for a single person.
      await GhlWorkflows.enrollContact(contact.ghl_contact_id, campaign.ghl_workflow_id)
      await supabase.from("marketing_audit_log").insert({
        actor_profile_id: user?.id ?? null,
        action: "campaign.test_sent",
        target_type: "campaign",
        target_id: id,
        meta: {
          channel: "ghl_workflow",
          to_contact: parsed.data.contactId,
          workflow_id: campaign.ghl_workflow_id,
        },
      })
      return NextResponse.json({ ok: true, messageId: campaign.ghl_workflow_id })
    }

    return NextResponse.json({ error: "Unknown campaign type" }, { status: 400 })
  } catch (err) {
    // Surface GHL's actual error body so the admin can fix the campaign
    // without digging through server logs.
    if (err instanceof GHLApiError) {
      console.error("[test-send] GHL API error", {
        status: err.status,
        endpoint: err.endpoint,
        body: err.body,
      })
      return NextResponse.json(
        {
          error: err.message,
          ghl_status: err.status,
          ghl_body: err.body,
          ghl_endpoint: err.endpoint,
        },
        { status: err.status >= 400 && err.status < 500 ? err.status : 500 },
      )
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error("[test-send] unexpected error", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
