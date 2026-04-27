/**
 * GHL -> Supabase mirror logic.
 *
 * Single source of truth for translating a GHL contact payload into a
 * row in `marketing_contacts`. Used by:
 *   - initial backfill script (scripts/ghl-initial-contact-sync.ts)
 *   - webhook receiver (/api/webhooks/ghl/contacts)
 *   - manual "force re-sync" button
 *
 * Keeps mapping logic in one place so webhook + backfill can't drift.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { normaliseAuPhone, normaliseEmail } from "./phone"
import type { GhlContact } from "./types"

export type MarketingContactSource =
  | "ghl_initial_sync"
  | "ghl_webhook"
  | "csv_import"
  | "manual"
  | "sms_auto_create"

export interface MirrorOptions {
  source: MarketingContactSource
  /** When true the call won't overwrite opt-out state set locally. */
  preserveLocalOptOut?: boolean
}

export interface MirrorResult {
  contactId: string
  created: boolean
}

/**
 * Upsert a GHL contact into `marketing_contacts` keyed by `ghl_contact_id`.
 *
 * Returns the local UUID + whether a new row was created.
 */
export async function mirrorGhlContact(
  supabase: SupabaseClient,
  contact: GhlContact,
  options: MirrorOptions,
): Promise<MirrorResult> {
  const customFields = normaliseCustomFields(contact.customFields)
  const firstName = contact.firstName?.trim() || undefined
  const lastName = contact.lastName?.trim() || undefined
  const fullName =
    contact.contactName?.trim() ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    undefined

  const payload = {
    ghl_contact_id: contact.id,
    email: normaliseEmail(contact.email),
    phone: normaliseAuPhone(contact.phone),
    first_name: firstName ?? null,
    last_name: lastName ?? null,
    full_name: fullName ?? null,
    company_name: contact.companyName?.trim() || null,
    address1: contact.address1?.trim() || null,
    city: contact.city?.trim() || null,
    state: contact.state?.trim() || null,
    postal_code: contact.postalCode?.trim() || null,
    country: contact.country?.trim() || "AU",
    tags: contact.tags ?? [],
    custom_fields: customFields,
    is_opted_out: contact.dnd === true ? true : undefined,
    source: options.source,
    last_synced_at: new Date().toISOString(),
  }

  // Remove keys with `undefined` so they don't overwrite existing values
  // with NULL on upsert. `null` is deliberate — that's "clear this field".
  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  )

  // Pre-claim step: if a legacy row exists with NULL ghl_contact_id but the
  // same email/phone (CSV import / signup created before the GHL link),
  // stamp it with this contact's id so the upsert below updates that row
  // instead of creating a duplicate. Skip if a row already carries this
  // ghl_contact_id — claiming would violate the unique constraint.
  if (payload.email || payload.phone) {
    const { data: alreadyMirrored } = await supabase
      .from("marketing_contacts")
      .select("id")
      .eq("ghl_contact_id", contact.id)
      .maybeSingle()

    if (!alreadyMirrored) {
      let legacyId: string | undefined
      if (payload.email) {
        const { data } = await supabase
          .from("marketing_contacts")
          .select("id")
          .is("ghl_contact_id", null)
          .ilike("email", payload.email as string)
          .limit(1)
          .maybeSingle()
        legacyId = data?.id
      }
      if (!legacyId && payload.phone) {
        const { data } = await supabase
          .from("marketing_contacts")
          .select("id")
          .is("ghl_contact_id", null)
          .eq("phone", payload.phone as string)
          .limit(1)
          .maybeSingle()
        legacyId = data?.id
      }
      if (legacyId) {
        await supabase
          .from("marketing_contacts")
          .update({ ghl_contact_id: contact.id })
          .eq("id", legacyId)
      }
    }
  }

  const { data, error } = await supabase
    .from("marketing_contacts")
    .upsert(cleaned, {
      onConflict: "ghl_contact_id",
      ignoreDuplicates: false,
    })
    .select("id, created_at, updated_at")
    .single()

  if (error) {
    throw new Error(`mirrorGhlContact failed: ${error.message}`)
  }

  // Heuristic for "created vs updated" — relies on:
  //   - INSERT: created_at and updated_at both default to now() in the same txn
  //     (identical timestamps, possibly with ms-level tolerance).
  //   - UPDATE: the `before update` trigger sets updated_at = now() while
  //     created_at stays at the original value (definitely different).
  // Only used for the sync script's "created/updated" counter — if PG ever
  // added a trigger that touches updated_at on insert, this would flip to
  // always-false (safe, just less informative).
  const created =
    data.created_at === data.updated_at ||
    Math.abs(
      new Date(data.created_at).getTime() - new Date(data.updated_at).getTime(),
    ) < 100

  return { contactId: data.id as string, created }
}

/**
 * Soft-delete a marketing contact when GHL sends a delete webhook.
 * Preserves the row so historical campaign stats still link to a contact name.
 */
export async function softDeleteMirrorContact(
  supabase: SupabaseClient,
  ghlContactId: string,
): Promise<void> {
  const { error } = await supabase
    .from("marketing_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("ghl_contact_id", ghlContactId)
  if (error) throw new Error(`softDelete failed: ${error.message}`)
}

function normaliseCustomFields(
  fields: GhlContact["customFields"],
): Record<string, unknown> {
  if (!fields || fields.length === 0) return {}
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const key = f.key || f.id
    if (!key) continue
    out[key] = f.value
  }
  return out
}
