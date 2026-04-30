import type { SupabaseClient } from "@supabase/supabase-js"

import { sendEmail } from "@/lib/email/send"
import { issueToken } from "@/lib/reviews/tokens"
import {
  buildInitialReviewEmail,
  buildReminderReviewEmail,
} from "@/lib/marketing/review-email-template"

/**
 * Review-job dispatcher.
 *
 * The DB trigger (queue_review_jobs_for_delivery) inserts two rows per
 * eligible order line when the order transitions to 'delivered':
 *   - kind=initial,  send_at = delivered_at + 7 days
 *   - kind=reminder, send_at = delivered_at + 14 days
 *
 * The daily cron hits /api/reviews/jobs/run, which calls runDueReviewJobs
 * below. For each due row:
 *   1. Skip-and-mark-skipped if the token has already been consumed (buyer
 *      submitted a review between scheduling and dispatch).
 *   2. For 'initial': mint a fresh signed token, persist its hash, send the
 *      initial email.
 *   3. For 'reminder': reuse the existing token if not consumed; otherwise
 *      skip (don't pester someone who already submitted).
 *
 * The runner is idempotent — running it twice with the same due rows
 * produces no additional emails because the row flips from 'pending' to
 * 'sent' before the next iteration.
 */

export interface RunSummary {
  processed: number
  sent: number
  skipped: number
  failed: number
  errors: { jobId: string; error: string }[]
}

interface ReviewJobRow {
  id: string
  order_id: string
  product_id: string
  kind: "initial" | "reminder"
  send_at: string
  status: "pending" | "sent" | "skipped" | "failed"
  attempts: number
}

interface OrderForEmail {
  id: string
  order_number: string
  user_id: string
  status: string
}

interface ProductForEmail {
  id: string
  name: string
  slug: string
}

interface RecipientForEmail {
  email: string
  contact_name: string | null
  company_name: string | null
}

const SUBMIT_PATH_PREFIX = "/reviews/submit"

function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://www.cqvs-chemconnect.com.au"
  ).replace(/\/$/, "")
}

async function loadOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderForEmail | null> {
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, user_id, status")
    .eq("id", orderId)
    .maybeSingle()
  return (data as OrderForEmail) ?? null
}

async function loadProduct(
  supabase: SupabaseClient,
  productId: string,
): Promise<ProductForEmail | null> {
  const { data } = await supabase
    .from("products")
    .select("id, name, slug")
    .eq("id", productId)
    .maybeSingle()
  return (data as ProductForEmail) ?? null
}

async function loadRecipient(
  supabase: SupabaseClient,
  userId: string,
): Promise<RecipientForEmail | null> {
  const { data } = await supabase
    .from("profiles")
    .select("email, contact_name, company_name")
    .eq("id", userId)
    .maybeSingle()
  return (data as RecipientForEmail) ?? null
}

async function existingTokenForJob(
  supabase: SupabaseClient,
  orderId: string,
  productId: string,
): Promise<{ id: string; consumed_at: string | null } | null> {
  const { data } = await supabase
    .from("review_tokens")
    .select("id, consumed_at")
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .maybeSingle()
  return data as { id: string; consumed_at: string | null } | null
}

async function markJob(
  supabase: SupabaseClient,
  jobId: string,
  status: "sent" | "skipped" | "failed",
  error?: string,
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (status === "sent") update.sent_at = new Date().toISOString()
  if (error) update.last_error = error
  await supabase.from("review_jobs").update(update).eq("id", jobId)
}

async function processJob(
  supabase: SupabaseClient,
  job: ReviewJobRow,
): Promise<"sent" | "skipped" | "failed"> {
  // Always bump attempts even on skip / fail.
  await supabase
    .from("review_jobs")
    .update({ attempts: job.attempts + 1 })
    .eq("id", job.id)

  const [order, product] = await Promise.all([
    loadOrder(supabase, job.order_id),
    loadProduct(supabase, job.product_id),
  ])

  if (!order || !product) {
    await markJob(supabase, job.id, "skipped", "order or product missing")
    return "skipped"
  }

  // Guard: order may have been moved out of 'delivered' (admin correction)
  // since the job was queued.
  if (order.status !== "delivered") {
    await markJob(supabase, job.id, "skipped", `order status = ${order.status}`)
    return "skipped"
  }

  const recipient = await loadRecipient(supabase, order.user_id)
  if (!recipient?.email) {
    await markJob(supabase, job.id, "skipped", "no recipient email")
    return "skipped"
  }

  // Token logic differs by kind.
  let tokenString: string
  const existing = await existingTokenForJob(
    supabase,
    job.order_id,
    job.product_id,
  )

  if (existing?.consumed_at) {
    // Buyer already submitted a review — don't email them again.
    await markJob(supabase, job.id, "skipped", "token already consumed")
    return "skipped"
  }

  if (job.kind === "reminder") {
    // Reminder must reuse the initial-send token. If none exists, fail soft.
    if (!existing) {
      await markJob(
        supabase,
        job.id,
        "skipped",
        "reminder fired without initial token (initial may have failed)",
      )
      return "skipped"
    }
    // We can't recover the original wire-format token (only the hash is in
    // DB). For reminder emails we issue a NEW token and replace the row's
    // hash; the prior hash is overwritten. The buyer's first email link
    // becomes invalid at this point — acceptable, the reminder is the
    // active CTA.
    const issued = issueToken({ orderId: job.order_id, productId: job.product_id })
    const { error: updErr } = await supabase
      .from("review_tokens")
      .update({
        token_hash: issued.tokenHash,
        expires_at: issued.expiresAt.toISOString(),
        attempt_count: 0,
        last_attempt_at: null,
      })
      .eq("id", existing.id)
    if (updErr) {
      await markJob(supabase, job.id, "failed", `token replace: ${updErr.message}`)
      return "failed"
    }
    tokenString = issued.token
  } else {
    // Initial — mint and persist a new token. The DB row id is generated
    // server-side by uuid_generate_v4(); the wire-format token's internal
    // tokenId is unrelated (it's just an entropy field inside the signed
    // payload, not a foreign key).
    const issued = issueToken({ orderId: job.order_id, productId: job.product_id })
    const { error: insErr } = await supabase.from("review_tokens").insert({
      order_id: job.order_id,
      product_id: job.product_id,
      token_hash: issued.tokenHash,
      expires_at: issued.expiresAt.toISOString(),
    })
    if (insErr) {
      await markJob(supabase, job.id, "failed", `token insert: ${insErr.message}`)
      return "failed"
    }
    tokenString = issued.token
  }

  // Build the email
  const submitUrl = `${getAppUrl()}${SUBMIT_PATH_PREFIX}?token=${encodeURIComponent(tokenString)}`
  const recipientName =
    recipient.contact_name?.trim() ||
    recipient.company_name?.trim() ||
    null

  const email =
    job.kind === "initial"
      ? buildInitialReviewEmail({
          recipientName,
          productName: product.name,
          orderNumber: order.order_number,
          submitUrl,
        })
      : buildReminderReviewEmail({
          recipientName,
          productName: product.name,
          orderNumber: order.order_number,
          submitUrl,
        })

  const ok = await sendEmail({
    to: recipient.email,
    subject: email.subject,
    heading: email.heading,
    preheader: email.preheader,
    sections: email.sections,
    ctaButton: { text: email.ctaText, url: submitUrl },
    footerNote: email.footerNote,
  })

  if (!ok) {
    await markJob(supabase, job.id, "failed", "mailgun send failed")
    return "failed"
  }

  await markJob(supabase, job.id, "sent")
  return "sent"
}

/**
 * Pull due review jobs and dispatch each. Bounded at 100 per run by the RPC.
 */
export async function runDueReviewJobs(
  supabase: SupabaseClient,
): Promise<RunSummary> {
  const summary: RunSummary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  const { data: due, error } = await supabase.rpc("due_review_jobs")
  if (error) {
    summary.errors.push({ jobId: "rpc", error: error.message })
    return summary
  }

  const jobs = (due ?? []) as ReviewJobRow[]
  for (const job of jobs) {
    summary.processed += 1
    try {
      const outcome = await processJob(supabase, job)
      if (outcome === "sent") summary.sent += 1
      else if (outcome === "skipped") summary.skipped += 1
      else summary.failed += 1
    } catch (err) {
      summary.failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      summary.errors.push({ jobId: job.id, error: msg })
      await markJob(supabase, job.id, "failed", msg)
    }
  }

  return summary
}
