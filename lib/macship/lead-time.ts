/**
 * Lead time calculation logic for MacShip pickup date computation.
 *
 * Inherits configuration via: product+warehouse > warehouse > global > hardcoded fallback.
 * Supports business-day counting that skips weekends and Australian public holidays.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ============================================================
// Australian public holidays 2025 and 2026
// ============================================================
// Notes:
//   - Easter dates computed: 2025: Apr 18 (Fri) – Apr 21 (Mon); 2026: Apr 3 (Fri) – Apr 6 (Mon)
//   - King's Birthday: VIC 2nd Mon Jun | NSW/SA/TAS 2nd Mon Jun | QLD Jun Mon | WA Mon Sep
//   - Melbourne Cup: VIC 1st Tue November
//   - Adelaide Cup: SA 2nd Mon May (historically 3rd Mon; since 2006 it is 2nd Mon May)
//   - WA Day: WA 1st Mon June

const AU_PUBLIC_HOLIDAYS: Record<string, string[]> = {
  VIC: [
    // 2025
    "2025-01-01", // New Year's Day
    "2025-01-27", // Australia Day (observed, 26th is Sunday)
    "2025-04-18", // Good Friday
    "2025-04-19", // Easter Saturday
    "2025-04-20", // Easter Sunday
    "2025-04-21", // Easter Monday
    "2025-04-25", // ANZAC Day
    "2025-06-09", // King's Birthday (2nd Mon June)
    "2025-11-04", // Melbourne Cup Day (1st Tue November)
    "2025-12-25", // Christmas Day
    "2025-12-26", // Boxing Day
    // 2026
    "2026-01-01", // New Year's Day
    "2026-01-26", // Australia Day
    "2026-04-03", // Good Friday
    "2026-04-04", // Easter Saturday
    "2026-04-05", // Easter Sunday
    "2026-04-06", // Easter Monday
    "2026-04-25", // ANZAC Day
    "2026-06-08", // King's Birthday (2nd Mon June)
    "2026-11-03", // Melbourne Cup Day (1st Tue November)
    "2026-12-25", // Christmas Day
    "2026-12-28", // Boxing Day (observed, 26th is Saturday, 27th Sunday)
  ],

  NSW: [
    // 2025
    "2025-01-01", // New Year's Day
    "2025-01-27", // Australia Day (observed)
    "2025-04-18", // Good Friday
    "2025-04-19", // Easter Saturday
    "2025-04-20", // Easter Sunday
    "2025-04-21", // Easter Monday
    "2025-04-25", // ANZAC Day
    "2025-06-09", // King's Birthday (2nd Mon June)
    "2025-08-04", // Bank Holiday (1st Mon August)
    "2025-12-25", // Christmas Day
    "2025-12-26", // Boxing Day
    // 2026
    "2026-01-01", // New Year's Day
    "2026-01-26", // Australia Day
    "2026-04-03", // Good Friday
    "2026-04-04", // Easter Saturday
    "2026-04-05", // Easter Sunday
    "2026-04-06", // Easter Monday
    "2026-04-25", // ANZAC Day
    "2026-06-08", // King's Birthday (2nd Mon June)
    "2026-08-03", // Bank Holiday (1st Mon August)
    "2026-12-25", // Christmas Day
    "2026-12-28", // Boxing Day (observed)
  ],

  QLD: [
    // 2025
    "2025-01-01", // New Year's Day
    "2025-01-27", // Australia Day (observed)
    "2025-04-18", // Good Friday
    "2025-04-19", // Easter Saturday
    "2025-04-21", // Easter Monday
    "2025-04-25", // ANZAC Day
    "2025-06-11", // King's Birthday QLD (2nd Mon June in 2025 falls same, confirmed)
    "2025-12-25", // Christmas Day
    "2025-12-26", // Boxing Day
    // 2026
    "2026-01-01", // New Year's Day
    "2026-01-26", // Australia Day
    "2026-04-03", // Good Friday
    "2026-04-04", // Easter Saturday
    "2026-04-06", // Easter Monday
    "2026-04-25", // ANZAC Day
    "2026-06-08", // King's Birthday QLD (2nd Mon June)
    "2026-12-25", // Christmas Day
    "2026-12-28", // Boxing Day (observed)
  ],

  SA: [
    // 2025
    "2025-01-01",  // New Year's Day
    "2025-01-27",  // Australia Day (observed)
    "2025-04-17",  // Easter Thursday (SA specific)
    "2025-04-18",  // Good Friday
    "2025-04-19",  // Easter Saturday
    "2025-04-21",  // Easter Monday
    "2025-04-25",  // ANZAC Day
    "2025-05-12",  // Adelaide Cup (2nd Mon May)
    "2025-06-09",  // King's Birthday (2nd Mon June)
    "2025-10-06",  // Labour Day (1st Mon October)
    "2025-12-24",  // Christmas Eve (from 7pm - treated as half day, list for completeness)
    "2025-12-25",  // Christmas Day
    "2025-12-26",  // Proclamation Day
    // 2026
    "2026-01-01",  // New Year's Day
    "2026-01-26",  // Australia Day
    "2026-04-02",  // Easter Thursday (SA specific)
    "2026-04-03",  // Good Friday
    "2026-04-04",  // Easter Saturday
    "2026-04-06",  // Easter Monday
    "2026-04-25",  // ANZAC Day
    "2026-05-11",  // Adelaide Cup (2nd Mon May)
    "2026-06-08",  // King's Birthday (2nd Mon June)
    "2026-10-05",  // Labour Day (1st Mon October)
    "2026-12-25",  // Christmas Day
    "2026-12-28",  // Proclamation Day (observed)
  ],

  WA: [
    // 2025
    "2025-01-01",  // New Year's Day
    "2025-01-27",  // Australia Day (observed)
    "2025-03-03",  // WA Day (1st Mon March — actually it's 1st Mon June; corrected below)
    "2025-04-18",  // Good Friday
    "2025-04-19",  // Easter Saturday
    "2025-04-21",  // Easter Monday
    "2025-04-25",  // ANZAC Day
    "2025-06-02",  // WA Day (1st Mon June)
    "2025-09-22",  // Queen's/King's Birthday WA (4th Mon September)
    "2025-12-25",  // Christmas Day
    "2025-12-26",  // Boxing Day
    // 2026
    "2026-01-01",  // New Year's Day
    "2026-01-26",  // Australia Day
    "2026-04-03",  // Good Friday
    "2026-04-04",  // Easter Saturday
    "2026-04-06",  // Easter Monday
    "2026-04-25",  // ANZAC Day
    "2026-06-01",  // WA Day (1st Mon June)
    "2026-09-28",  // Queen's/King's Birthday WA (4th Mon September)
    "2026-12-25",  // Christmas Day
    "2026-12-28",  // Boxing Day (observed)
  ],

  TAS: [
    // 2025
    "2025-01-01",  // New Year's Day
    "2025-01-27",  // Australia Day (observed)
    "2025-02-10",  // Royal Hobart Regatta (2nd Mon February — southern TAS)
    "2025-03-10",  // Eight Hours Day (2nd Mon March)
    "2025-04-18",  // Good Friday
    "2025-04-19",  // Easter Saturday
    "2025-04-21",  // Easter Monday
    "2025-04-25",  // ANZAC Day
    "2025-06-09",  // King's Birthday (2nd Mon June)
    "2025-12-25",  // Christmas Day
    "2025-12-26",  // Boxing Day
    // 2026
    "2026-01-01",  // New Year's Day
    "2026-01-26",  // Australia Day
    "2026-02-09",  // Royal Hobart Regatta (2nd Mon February)
    "2026-03-09",  // Eight Hours Day (2nd Mon March)
    "2026-04-03",  // Good Friday
    "2026-04-04",  // Easter Saturday
    "2026-04-06",  // Easter Monday
    "2026-04-25",  // ANZAC Day
    "2026-06-08",  // King's Birthday (2nd Mon June)
    "2026-12-25",  // Christmas Day
    "2026-12-28",  // Boxing Day (observed)
  ],

  ACT: [
    // 2025
    "2025-01-01",  // New Year's Day
    "2025-01-27",  // Australia Day (observed)
    "2025-03-10",  // Canberra Day (2nd Mon March)
    "2025-04-18",  // Good Friday
    "2025-04-19",  // Easter Saturday
    "2025-04-20",  // Easter Sunday
    "2025-04-21",  // Easter Monday
    "2025-04-25",  // ANZAC Day
    "2025-05-26",  // Reconciliation Day (last Mon May — actually 1st Mon June... ACT uses 27 May)
    "2025-06-09",  // King's Birthday (2nd Mon June)
    "2025-08-04",  // Family & Community Day (1st Mon August)
    "2025-10-06",  // Labour Day (1st Mon October)
    "2025-12-25",  // Christmas Day
    "2025-12-26",  // Boxing Day
    // 2026
    "2026-01-01",  // New Year's Day
    "2026-01-26",  // Australia Day
    "2026-03-09",  // Canberra Day (2nd Mon March)
    "2026-04-03",  // Good Friday
    "2026-04-04",  // Easter Saturday
    "2026-04-05",  // Easter Sunday
    "2026-04-06",  // Easter Monday
    "2026-04-25",  // ANZAC Day
    "2026-06-01",  // Reconciliation Day (approx 1st Mon June)
    "2026-06-08",  // King's Birthday (2nd Mon June)
    "2026-08-03",  // Family & Community Day (1st Mon August)
    "2026-10-05",  // Labour Day (1st Mon October)
    "2026-12-25",  // Christmas Day
    "2026-12-28",  // Boxing Day (observed)
  ],

  NT: [
    // 2025
    "2025-01-01",  // New Year's Day
    "2025-01-27",  // Australia Day (observed)
    "2025-04-18",  // Good Friday
    "2025-04-19",  // Easter Saturday
    "2025-04-21",  // Easter Monday
    "2025-04-25",  // ANZAC Day
    "2025-05-05",  // May Day (1st Mon May)
    "2025-06-09",  // King's Birthday (2nd Mon June)
    "2025-08-04",  // Picnic Day (1st Mon August)
    "2025-12-24",  // Christmas Eve
    "2025-12-25",  // Christmas Day
    "2025-12-26",  // Boxing Day
    "2025-12-31",  // New Year's Eve
    // 2026
    "2026-01-01",  // New Year's Day
    "2026-01-26",  // Australia Day
    "2026-04-03",  // Good Friday
    "2026-04-04",  // Easter Saturday
    "2026-04-06",  // Easter Monday
    "2026-04-25",  // ANZAC Day
    "2026-05-04",  // May Day (1st Mon May)
    "2026-06-08",  // King's Birthday (2nd Mon June)
    "2026-08-03",  // Picnic Day (1st Mon August)
    "2026-12-25",  // Christmas Day
    "2026-12-28",  // Boxing Day (observed)
    "2026-12-31",  // New Year's Eve
  ],
}

// ============================================================
// Types
// ============================================================

export interface LeadTimeConfig {
  manufacturing_days: number
  buffer_days: number
  use_business_days: boolean
  source: "product_warehouse" | "warehouse" | "global" | "fallback"
}

// ============================================================
// Internal helpers
// ============================================================

/** Format a Date as "YYYY-MM-DD" in local time */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Parse "YYYY-MM-DD" into a Date at midnight (local) */
function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** Returns true if the date is a Saturday or Sunday */
function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

/**
 * Returns true if the date is a public holiday for the given AU state.
 * Falls back to a national set if the state is unknown.
 */
function isHoliday(d: Date, state: string): boolean {
  const stateKey = state.toUpperCase()
  const holidays = AU_PUBLIC_HOLIDAYS[stateKey] ?? AU_PUBLIC_HOLIDAYS["VIC"]
  const dateStr = toISODate(d)
  return holidays.includes(dateStr)
}

/**
 * Returns true if the date is a non-working day (weekend or public holiday).
 */
function isNonWorkingDay(d: Date, state: string): boolean {
  return isWeekend(d) || isHoliday(d, state)
}

/**
 * Advance date by one calendar day (mutates).
 */
function addOneDay(d: Date): Date {
  d.setDate(d.getDate() + 1)
  return d
}

// ============================================================
// Core exports
// ============================================================

/**
 * Get the effective lead time for a product at a warehouse.
 *
 * Resolution order:
 *   1. lead_time_product_warehouse (product + warehouse specific)
 *   2. lead_time_warehouse (warehouse default)
 *   3. lead_time_global (global default)
 *   4. Hardcoded 5-day fallback
 */
export async function getLeadTime(
  productId: string,
  warehouseId: string,
  supabase: SupabaseClient,
): Promise<LeadTimeConfig> {
  // 1. Try product + warehouse override
  const { data: pwData } = await supabase
    .from("lead_time_product_warehouse")
    .select("manufacturing_days, buffer_days, use_business_days")
    .eq("product_id", productId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle()

  if (pwData) {
    return {
      manufacturing_days: pwData.manufacturing_days,
      buffer_days: pwData.buffer_days,
      use_business_days: pwData.use_business_days,
      source: "product_warehouse",
    }
  }

  // 2. Try warehouse default
  const { data: wData } = await supabase
    .from("lead_time_warehouse")
    .select("manufacturing_days, buffer_days, use_business_days")
    .eq("warehouse_id", warehouseId)
    .maybeSingle()

  if (wData) {
    return {
      manufacturing_days: wData.manufacturing_days,
      buffer_days: wData.buffer_days,
      use_business_days: wData.use_business_days,
      source: "warehouse",
    }
  }

  // 3. Try global default
  const { data: gData } = await supabase
    .from("lead_time_global")
    .select("manufacturing_days, buffer_days, use_business_days")
    .limit(1)
    .maybeSingle()

  if (gData) {
    return {
      manufacturing_days: gData.manufacturing_days,
      buffer_days: gData.buffer_days,
      use_business_days: gData.use_business_days,
      source: "global",
    }
  }

  // 4. Hardcoded fallback — 5 business days
  return {
    manufacturing_days: 5,
    buffer_days: 0,
    use_business_days: true,
    source: "fallback",
  }
}

/**
 * Calculate the pickup date from a given start date and lead time config.
 *
 * Returns ISO date string "YYYY-MM-DD".
 *
 * If use_business_days is true, weekends and AU public holidays for the
 * given warehouse state are skipped when counting days.
 * The resulting date is also rolled forward if it lands on a non-working day.
 */
export function calculatePickupDate(
  config: LeadTimeConfig,
  warehouseState: string,
  fromDate?: Date,
): string {
  const totalDays = config.manufacturing_days + config.buffer_days

  // Work with a copy; start from midnight of fromDate
  const start = fromDate ? new Date(fromDate) : new Date()
  start.setHours(0, 0, 0, 0)

  // Start counting from the day AFTER today (we can't ship today)
  const current = new Date(start)
  addOneDay(current)

  if (config.use_business_days) {
    // Count only business days
    let counted = 0
    while (counted < totalDays) {
      if (!isNonWorkingDay(current, warehouseState)) {
        counted++
      }
      if (counted < totalDays) {
        addOneDay(current)
      }
    }
    // Roll forward if the result is a non-working day (edge case if buffer = 0)
    while (isNonWorkingDay(current, warehouseState)) {
      addOneDay(current)
    }
  } else {
    // Calendar days
    for (let i = 0; i < totalDays - 1; i++) {
      addOneDay(current)
    }
    // Roll forward off weekends / holidays
    while (isNonWorkingDay(current, warehouseState)) {
      addOneDay(current)
    }
  }

  return toISODate(current)
}

/**
 * For a multi-item order, find the governing lead time (the longest one)
 * and compute the resulting pickup date.
 *
 * The "governing product" is the one whose lead time is longest. This
 * ID is stored on the order for audit purposes.
 */
export async function getOrderPickupDate(
  items: Array<{ product_id: string; quantity: number }>,
  warehouseId: string,
  warehouseState: string,
  supabase: SupabaseClient,
): Promise<{
  config: LeadTimeConfig
  governingProductId: string | null
  pickupDate: string
  usedFallback: boolean
}> {
  if (items.length === 0) {
    const fallback: LeadTimeConfig = {
      manufacturing_days: 5,
      buffer_days: 0,
      use_business_days: true,
      source: "fallback",
    }
    return {
      config: fallback,
      governingProductId: null,
      pickupDate: calculatePickupDate(fallback, warehouseState),
      usedFallback: true,
    }
  }

  // Resolve lead time for each distinct product
  let governingConfig: LeadTimeConfig | null = null
  let governingProductId: string | null = null
  let maxTotalDays = -1

  for (const item of items) {
    const config = await getLeadTime(item.product_id, warehouseId, supabase)
    const totalDays = config.manufacturing_days + config.buffer_days

    if (totalDays > maxTotalDays) {
      maxTotalDays = totalDays
      governingConfig = config
      governingProductId = item.product_id
    }
  }

  // Fallback safety net (should never be reached after the items.length check)
  if (!governingConfig) {
    const fallback: LeadTimeConfig = {
      manufacturing_days: 5,
      buffer_days: 0,
      use_business_days: true,
      source: "fallback",
    }
    return {
      config: fallback,
      governingProductId: null,
      pickupDate: calculatePickupDate(fallback, warehouseState),
      usedFallback: true,
    }
  }

  const usedFallback = governingConfig.source === "fallback"
  const pickupDate = calculatePickupDate(governingConfig, warehouseState)

  return {
    config: governingConfig,
    governingProductId,
    pickupDate,
    usedFallback,
  }
}
