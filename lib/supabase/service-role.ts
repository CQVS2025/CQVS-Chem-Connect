/**
 * Server-side Supabase client using the service role key.
 *
 * Bypasses RLS - use only in trusted server contexts (background jobs,
 * webhooks, admin sync flows). Never expose this client to user code.
 */

import { createClient } from "@supabase/supabase-js"

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
