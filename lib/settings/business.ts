// Business-level settings (tax rate, currency, Stripe fees, min order
// value) read from the admin_settings key/value table.
//
// All settings are read with safe defaults so a fresh database with no
// rows still calculates orders correctly. Admin changes through the
// /admin/settings page take effect on the next quote (no caching - the
// table is small and reads are infrequent).

import type { SupabaseClient } from "@supabase/supabase-js"

export interface BusinessSettings {
  taxRate: number // 0.10 = 10% GST
  currency: string // "AUD"
  stripeFeePercent: number // 0.0175 = 1.75%
  stripeFeeFixed: number // 0.30
  stripeFeeGst: number // 0.10 (GST on the Stripe fee itself)
  minOrderValue: number // 100 = require buyer subtotal >= $100
}

export const BUSINESS_DEFAULTS: BusinessSettings = {
  taxRate: 0.1,
  currency: "AUD",
  stripeFeePercent: 0.0175,
  stripeFeeFixed: 0.3,
  stripeFeeGst: 0.1,
  minOrderValue: 100,
}

/**
 * Map raw admin_settings rows (string values) into a parsed
 * BusinessSettings object. Falls back to BUSINESS_DEFAULTS for any
 * missing or malformed values.
 *
 * The settings page stores tax_rate as a percentage ("10") but the
 * calculator expects a fraction (0.10). We do that conversion here so
 * the rest of the codebase doesn't have to think about it.
 */
export function parseBusinessSettings(
  raw: Record<string, string | null | undefined>,
): BusinessSettings {
  const num = (v: string | null | undefined, fallback: number): number => {
    if (v === null || v === undefined || v === "") return fallback
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }

  const taxRatePct = num(raw.tax_rate, BUSINESS_DEFAULTS.taxRate * 100)
  const stripePct = num(raw.stripe_fee_percent, BUSINESS_DEFAULTS.stripeFeePercent * 100)
  const stripeGstPct = num(raw.stripe_fee_gst, BUSINESS_DEFAULTS.stripeFeeGst * 100)

  return {
    taxRate: taxRatePct / 100,
    currency: (raw.currency || BUSINESS_DEFAULTS.currency).toUpperCase(),
    stripeFeePercent: stripePct / 100,
    stripeFeeFixed: num(raw.stripe_fee_fixed, BUSINESS_DEFAULTS.stripeFeeFixed),
    stripeFeeGst: stripeGstPct / 100,
    minOrderValue: num(raw.min_order_value, BUSINESS_DEFAULTS.minOrderValue),
  }
}

/**
 * Load and parse the business settings using the supplied Supabase
 * client. Always succeeds - if the table is empty or unreachable,
 * returns BUSINESS_DEFAULTS so order math still works.
 */
export async function getBusinessSettings(
  supabase: SupabaseClient,
): Promise<BusinessSettings> {
  const { data } = await supabase
    .from("admin_settings")
    .select("key, value")
    .in("key", [
      "tax_rate",
      "currency",
      "stripe_fee_percent",
      "stripe_fee_fixed",
      "stripe_fee_gst",
      "min_order_value",
    ])

  const raw: Record<string, string> = {}
  for (const row of (data ?? []) as Array<{ key: string; value: string | null }>) {
    if (row.value !== null) raw[row.key] = row.value
  }
  return parseBusinessSettings(raw)
}
