/**
 * Resolve a campaign's audience_filter into a list of recipient contacts.
 *
 * audience_filter shapes supported:
 *   { all: true }                          -> every non-opted-out contact
 *   { tags: ["quarries", "vip"] }           -> contacts with ANY of these tags
 *   { state: "QLD" }                        -> contacts in this state
 *   { contactIds: ["id1", "id2"] }          -> explicit list
 *
 * Returns an array of local marketing_contacts rows with fields the
 * dispatcher needs: local id, ghl_contact_id, email, phone, is_opted_out.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export interface AudienceFilter {
  all?: boolean
  tags?: string[]
  /**
   * When true (default), a multi-tag filter means "contact has ALL of these
   * tags" (intersection / AND). When false, it means "contact has ANY of
   * these tags" (union / OR).
   * Single-tag filters behave identically either way.
   */
  tagMatchAll?: boolean
  state?: string
  contactIds?: string[]
}

export interface AudienceMember {
  id: string
  ghl_contact_id: string | null
  email: string | null
  phone: string | null
  is_opted_out: boolean
  full_name: string | null
  // Extra fields pulled for merge-tag substitution (subject / body personalisation).
  first_name: string | null
  last_name: string | null
  company_name: string | null
  state: string | null
  country: string | null
}

export async function resolveAudience(
  supabase: SupabaseClient,
  filter: AudienceFilter,
): Promise<AudienceMember[]> {
  let query = supabase
    .from("marketing_contacts")
    .select(
      "id, ghl_contact_id, email, phone, is_opted_out, full_name, first_name, last_name, company_name, state, country",
    )
    .is("deleted_at", null)
    .eq("is_opted_out", false)

  if (filter.contactIds && filter.contactIds.length > 0) {
    query = query.in("id", filter.contactIds)
  } else if (filter.tags && filter.tags.length > 0) {
    // Default AND semantics (contact has ALL the tags). `tagMatchAll: false`
    // flips to OR (contact has ANY of the tags).
    const matchAll = filter.tagMatchAll !== false
    query = matchAll
      ? query.contains("tags", filter.tags)
      : query.overlaps("tags", filter.tags)
  } else if (filter.state) {
    query = query.eq("state", filter.state)
  }
  // If no filter keys match, we fall through and return everyone matching the
  // opted-out / deleted constraints — which is also the "all" case.

  const { data, error } = await query.limit(10000)
  if (error) {
    throw new Error(`resolveAudience failed: ${error.message}`)
  }
  return (data as AudienceMember[]) ?? []
}

/**
 * Count-only variant — used for preview ("This campaign will reach 342
 * contacts") without loading every row client-side.
 */
export async function countAudience(
  supabase: SupabaseClient,
  filter: AudienceFilter,
): Promise<number> {
  let query = supabase
    .from("marketing_contacts")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("is_opted_out", false)

  if (filter.contactIds && filter.contactIds.length > 0) {
    query = query.in("id", filter.contactIds)
  } else if (filter.tags && filter.tags.length > 0) {
    const matchAll = filter.tagMatchAll !== false
    query = matchAll
      ? query.contains("tags", filter.tags)
      : query.overlaps("tags", filter.tags)
  } else if (filter.state) {
    query = query.eq("state", filter.state)
  }

  const { count, error } = await query
  if (error) throw new Error(`countAudience failed: ${error.message}`)
  return count ?? 0
}
