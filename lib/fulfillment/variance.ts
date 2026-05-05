// Variance check (component 16).
//
// When the supplier confirms dispatch, we re-quote freight using the
// supplier's confirmed origin depot. If the recalculated number drifts
// from the indicative quote by more than the configured threshold,
// the order is flagged for admin review and the buyer is notified.
//
// Default threshold (locked per the plan): 10% or $100, whichever is
// greater. Configurable via admin_settings:
//   supplier_variance_pct   (default 10)
//   supplier_variance_floor (default 100)

import type { SupabaseClient } from "@supabase/supabase-js"

export interface VarianceCheckResult {
  flagged: boolean
  delta: number
  thresholdAbsolute: number
  pctConfigured: number
  floorConfigured: number
}

export async function getVarianceThresholds(
  supabase: SupabaseClient,
): Promise<{ pct: number; floor: number }> {
  const { data } = await supabase
    .from("admin_settings")
    .select("key, value")
    .in("key", ["supplier_variance_pct", "supplier_variance_floor"])
  const map = Object.fromEntries(
    (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]),
  )
  return {
    pct: parseFloat(map.supplier_variance_pct ?? "10"),
    floor: parseFloat(map.supplier_variance_floor ?? "100"),
  }
}

export function evaluateVariance(
  quoted: number,
  recalculated: number,
  pct: number,
  floor: number,
): VarianceCheckResult {
  const delta = Math.abs(recalculated - quoted)
  const pctThreshold = quoted * (pct / 100)
  const thresholdAbsolute = Math.max(pctThreshold, floor)
  return {
    flagged: delta > thresholdAbsolute,
    delta: Math.round(delta * 100) / 100,
    thresholdAbsolute: Math.round(thresholdAbsolute * 100) / 100,
    pctConfigured: pct,
    floorConfigured: floor,
  }
}
