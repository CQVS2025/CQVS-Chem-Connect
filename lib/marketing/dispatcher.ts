/**
 * Campaign dispatcher - turns a `marketing_campaigns` row into actual sends.
 *
 * Concurrency: sends run in parallel batches of CONCURRENCY recipients at a
 * time. This keeps per-campaign wall-time under the serverless budget while
 * respecting GHL's per-minute rate limits.
 *
 * Attribution: on each send we write a `marketing_events` row with
 * `event_type='delivered'` and `ghl_event_id = ghl_message_id`. The event
 * webhook then looks up campaign_id by messageId for proper attribution
 * instead of guessing from the most recent campaign.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { GhlCampaigns, GhlConversations, GhlWorkflows } from "@/lib/ghl"
import {
  countAudience,
  resolveAudience,
  type AudienceFilter,
  type AudienceMember,
} from "./audience"
import { forceLeftAlignDocument } from "./email-template"
import { substituteMergeTags, type MergeTagContext } from "./merge-tags"

export interface CampaignRow {
  id: string
  name: string
  type: "email" | "sms" | "ghl_workflow"
  status: string
  audience_filter: AudienceFilter
  subject: string | null
  body_html: string | null
  body_text: string | null
  template_mode: "plain" | "branded" | "custom_html" | null
  from_email: string | null
  from_name: string | null
  reply_to: string | null
  // Populated when the campaign was saved as scheduled. Carried through to
  // audit logs by the cron worker so we can trace which fire corresponded
  // to which scheduled time.
  scheduled_at?: string | null
  // Only populated for type === "ghl_workflow". Workflow is designed in GHL;
  // on dispatch we enrol each contact into it and GHL runs the drip.
  ghl_workflow_id?: string | null
  ghl_workflow_name?: string | null
}

export interface DispatchResult {
  campaignId: string
  audienceCount: number
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{ contactId: string; error: string }>
}

/** Parallel sends per batch - tuned to fit 1000+ contacts inside 60s. */
const CONCURRENCY = 6
/** Small inter-batch pause to spread load across GHL's per-minute window. */
const BATCH_PAUSE_MS = 50

export async function dispatchCampaign(
  supabase: SupabaseClient,
  campaign: CampaignRow,
): Promise<DispatchResult> {
  await supabase
    .from("marketing_campaigns")
    .update({ status: "sending", sent_at: null })
    .eq("id", campaign.id)

  const audience = await resolveAudience(supabase, campaign.audience_filter)
  await supabase
    .from("marketing_campaigns")
    .update({ audience_count: audience.length })
    .eq("id", campaign.id)

  let succeeded = 0
  let failed = 0
  let skipped = 0
  const errors: Array<{ contactId: string; error: string }> = []

  for (let i = 0; i < audience.length; i += CONCURRENCY) {
    const batch = audience.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (member) => sendOne(supabase, campaign, member)),
    )
    for (const r of results) {
      if (r.status === "succeeded") succeeded += 1
      else if (r.status === "failed") {
        failed += 1
        errors.push({ contactId: r.contactId, error: r.error ?? "" })
      } else skipped += 1
    }
    if (i + CONCURRENCY < audience.length) {
      await sleep(BATCH_PAUSE_MS)
    }
  }

  // For email/SMS campaigns: "delivered" is our proxy for successful GHL API
  // handoffs (GHL doesn't emit a reliable delivery event for outbound sends).
  // For ghl_workflow campaigns: every success is a workflow enrolment, not a
  // delivery - GHL will send the actual emails later as the workflow runs.
  const finalUpdate: Record<string, unknown> = {
    status: failed > 0 && succeeded === 0 ? "failed" : "sent",
    sent_at: new Date().toISOString(),
    failed_count: failed,
  }
  if (campaign.type === "ghl_workflow") {
    finalUpdate.enrolled_count = succeeded
  } else {
    finalUpdate.delivered_count = succeeded
  }
  await supabase
    .from("marketing_campaigns")
    .update(finalUpdate)
    .eq("id", campaign.id)

  return {
    campaignId: campaign.id,
    audienceCount: audience.length,
    succeeded,
    failed,
    skipped,
    errors,
  }
}

type SendResult =
  | {
      status: "succeeded"
      contactId: string
      messageId: string
      emailMessageId?: string
    }
  | { status: "failed"; contactId: string; error: string }
  | { status: "skipped"; contactId: string; reason: string }

async function sendOne(
  supabase: SupabaseClient,
  campaign: CampaignRow,
  member: AudienceMember,
): Promise<SendResult> {
  const displayId = member.ghl_contact_id ?? member.id

  // Channel-specific eligibility checks. Every channel requires the contact
  // to be linked to GHL (we need the GHL contact ID for any API call).
  if (!member.ghl_contact_id) {
    return { status: "skipped", contactId: displayId, reason: "not linked to GHL" }
  }
  if (campaign.type === "email" && !member.email) {
    return { status: "skipped", contactId: displayId, reason: "no email" }
  }
  if (campaign.type === "sms" && !member.phone) {
    return { status: "skipped", contactId: displayId, reason: "no phone" }
  }
  if (campaign.type === "ghl_workflow" && !campaign.ghl_workflow_id) {
    return { status: "failed", contactId: displayId, error: "workflow not configured on campaign" }
  }

  // GHL workflow enrolment path - no email/SMS content is sent from here;
  // GHL runs the whole drip sequence (emails, waits, branches) on its own.
  if (campaign.type === "ghl_workflow") {
    const workflowId = campaign.ghl_workflow_id as string
    try {
      await GhlWorkflows.enrollContact(member.ghl_contact_id, workflowId)
      // Log the enrolment so the recent-events feed and future audit queries
      // can show which contacts were handed off to which workflow and when.
      // ghl_event_id is a synthesised unique key (contact+workflow+timestamp)
      // because GHL doesn't return an event id for enrolment responses.
      await supabase.from("marketing_events").insert({
        ghl_event_id: `enrol-${campaign.id}-${member.id}-${Date.now()}`,
        event_type: "workflow_enrolled",
        campaign_id: campaign.id,
        contact_id: member.id,
        ghl_contact_id: member.ghl_contact_id,
        metadata: {
          workflow_id: workflowId,
          workflow_name: campaign.ghl_workflow_name ?? null,
        },
        occurred_at: new Date().toISOString(),
      })
      return { status: "succeeded", contactId: displayId, messageId: workflowId }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Best-effort failure log so the detail page can surface what went wrong
      // per-recipient (e.g. contact deleted in GHL, workflow unpublished).
      await supabase.from("marketing_events").insert({
        ghl_event_id: `enrol-fail-${campaign.id}-${member.id}-${Date.now()}`,
        event_type: "workflow_enroll_failed",
        campaign_id: campaign.id,
        contact_id: member.id,
        ghl_contact_id: member.ghl_contact_id,
        metadata: {
          workflow_id: workflowId,
          error: msg,
        },
        occurred_at: new Date().toISOString(),
      })
      return { status: "failed", contactId: displayId, error: msg }
    }
  }

  try {
    // Per-recipient merge tag substitution. The campaign template stores
    // `{{first_name}}` etc. verbatim; each send gets the tags resolved
    // against that contact's data before handing off to GHL.
    const ctx: MergeTagContext = memberToMergeContext(member)

    let messageId: string
    let emailMessageId: string | undefined
    if (campaign.type === "email") {
      // For plain-mode emails, retrofit a left-align override onto whatever
      // is stored. New campaigns already have it baked in by the wrapper;
      // older drafts saved before that fix get patched here so they don't
      // need to be manually re-saved.
      const rawHtml = substituteMergeTags(campaign.body_html as string, ctx, {
        escapeHtml: true,
      })
      const html =
        campaign.template_mode === "plain"
          ? forceLeftAlignDocument(rawHtml)
          : rawHtml
      const res = await GhlCampaigns.sendEmailMessage({
        contactId: member.ghl_contact_id,
        subject: substituteMergeTags(campaign.subject as string, ctx),
        html,
        fromEmail: campaign.from_email ?? undefined,
        fromName: campaign.from_name ?? undefined,
        replyTo: campaign.reply_to ?? undefined,
      })
      messageId = res.messageId
      emailMessageId = res.emailMessageId
    } else {
      const res = await GhlConversations.sendSmsMessage({
        contactId: member.ghl_contact_id,
        message: substituteMergeTags(campaign.body_text as string, ctx),
      })
      messageId = res.messageId
    }

    // Write an attribution anchor so later open/click webhooks can look up
    // campaign_id deterministically. Two identifiers are stored:
    //   - message_id: GHL's conversation messageId (always present)
    //   - email_message_id: SMTP Message-ID header (emails only, when GHL
    //     surfaces it on the send response - matches LCEmailStats webhook).
    // Idempotent on ghl_event_id.
    await supabase.from("marketing_events").upsert(
      {
        ghl_event_id: `sent-${messageId}`,
        event_type: "delivered",
        campaign_id: campaign.id,
        contact_id: member.id,
        ghl_contact_id: member.ghl_contact_id,
        metadata: {
          message_id: messageId,
          email_message_id: emailMessageId,
          recipient_email: member.email,
          attribution_anchor: true,
        },
        occurred_at: new Date().toISOString(),
      },
      { onConflict: "ghl_event_id", ignoreDuplicates: true },
    )

    return { status: "succeeded", contactId: displayId, messageId, emailMessageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { status: "failed", contactId: displayId, error: msg }
  }
}

export async function previewCampaign(
  supabase: SupabaseClient,
  filter: AudienceFilter,
): Promise<{ audienceCount: number }> {
  return { audienceCount: await countAudience(supabase, filter) }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function memberToMergeContext(member: AudienceMember): MergeTagContext {
  return {
    first_name: member.first_name,
    last_name: member.last_name,
    full_name: member.full_name,
    email: member.email,
    phone: member.phone,
    company_name: member.company_name,
    state: member.state,
    country: member.country,
  }
}
