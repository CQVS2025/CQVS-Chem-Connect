/**
 * Machship API client (V2).
 *
 * Uses the official Machship API at https://api.machship.com.
 * Authentication: token is passed in the `token` HTTP header (NOT Bearer).
 * The same base URL is used for test and production — the token determines
 * which environment is hit.
 *
 * Swagger reference: https://api.machship.com/swagger/v2/swagger.json
 */

// ============================================================
// Configuration
// ============================================================

const MACHSHIP_BASE = "https://api.machship.com"

function getConfig(): { baseUrl: string; token: string } {
  const mode = (process.env.MACSHIP_MODE ?? "test").toLowerCase()
  const isProduction = mode === "production"

  const token = isProduction
    ? process.env.MACSHIP_PRODUCTION_API_TOKEN
    : process.env.MACSHIP_TEST_API_TOKEN

  if (!token) {
    throw new MacShipError(
      401,
      `MACSHIP_${isProduction ? "PRODUCTION" : "TEST"}_API_TOKEN is not set`,
    )
  }

  return { baseUrl: MACHSHIP_BASE, token }
}

// ============================================================
// Error class
// ============================================================

export class MacShipError extends Error {
  status: number
  rawBody: string

  constructor(status: number, message: string, rawBody = "") {
    super(message)
    this.name = "MacShipError"
    this.status = status
    this.rawBody = rawBody
  }
}

// ============================================================
// Machship V2 types — match the official Swagger schema
// ============================================================

/**
 * Machship ItemType enum (subset of common types).
 * Full list includes 70+ values — see /apiv2 swagger ItemType schema.
 */
export const MachshipItemType = {
  Carton: 1,
  Skid: 2,
  Pallet: 3,
  Crate: 4,
  Satchel: 5,
  Bag: 8,
  Pack: 12,
  IBC: 26,
  Drum: 32,
  Bottle: 75,
} as const

export type MachshipItemTypeValue = (typeof MachshipItemType)[keyof typeof MachshipItemType]

/**
 * Request item — used in routes/returnroutes and consignments/createConsignment.
 * All fields camelCase per Machship spec.
 */
export interface MachshipItem {
  /** Packaging type — Machship uses this to match against carrier rate cards */
  itemType?: MachshipItemTypeValue
  /** Item description / name */
  name: string
  /** SKU or item code (optional) */
  sku?: string
  /** Number of items */
  quantity: number
  /** Weight in kg */
  weight: number
  /** Length in cm */
  length: number
  /** Width in cm */
  width: number
  /** Height in cm */
  height: number
  /** Pallet spaces (optional, for palletised freight) */
  palletSpaces?: number
}

/** Internal alias used in legacy code */
export type MacShipItem = MachshipItem

/**
 * Send location — pickup or delivery point.
 * Machship's SendLocationV2 only takes suburb + postcode.
 * Street/contact info goes into the consignment fields directly.
 */
export interface MachshipLocation {
  suburb: string
  postcode: string
}

/**
 * Request payload for POST /apiv2/routes/returnroutes
 * Returns available carrier routes with pricing.
 */
export interface MachshipRouteRequest {
  /** Required — your Machship company ID */
  companyId?: number
  despatchDateTimeLocal?: string
  despatchDateTimeUtc?: string
  fromLocation: MachshipLocation
  toLocation: MachshipLocation
  fromAddressLine1?: string
  fromAddressLine2?: string
  toAddressLine1?: string
  toAddressLine2?: string
  fromName?: string
  toName?: string
  items: MachshipItem[]
  /** IDs of question/option choices (e.g. residential delivery, tailgate) */
  questionIds?: number[]
  customerReference?: string
}

/** Response wrapper used by Machship for all endpoints */
export interface MachshipResponse<T> {
  object: T | null
  errors?: Array<{
    errorMessage?: string
    message?: string
    memberNames?: string[]
    validationType?: string
  }>
}

export interface MachshipCarrierLite {
  id: number
  name: string
  abbreviation: string
  displayName: string
}

export interface MachshipConsignmentTotal {
  totalSellPrice: number
  totalCostPrice: number
  totalSellBeforeTax: number
  totalCostBeforeTax: number
  totalBaseSellPrice: number
  totalBaseCostPrice: number
  totalTaxSellPrice: number
  totalTaxCostPrice: number
  sellFuelLevyPrice: number
  costFuelLevyPrice: number
  consignmentRouteSellPrice: number
  consignmentRouteCostPrice: number
  totalConsignmentCarrierSurchargesSellPrice: number
  totalConsignmentCarrierSurchargesCostPrice: number
}

export interface MachshipSurcharge {
  name: string
  costPrice: number
  sellPrice: number
  quantity: number
}

export interface MachshipCarrierServiceLite {
  id: number
  name: string
  abbreviation: string
  displayName: string
}

export interface MachshipDespatchOption {
  despatchDateLocal: string
  etaLocal: string
  totalBusinessDays: number
  totalDays: number
}

export interface MachshipSimpleRoute {
  requestId: string
  carrier: MachshipCarrierLite
  carrierService?: MachshipCarrierServiceLite
  consignmentTotal: MachshipConsignmentTotal
  totalWeight: number
  totalCubic: number
  priceDisplay: number
  isHourly: boolean
  fuelLevyPercentage: number
  sellFuelLevyPercentage: number
  taxPercentage: number
  automaticSurcharges?: MachshipSurcharge[]
  electiveSurcharges?: MachshipSurcharge[]
  despatchOptions?: MachshipDespatchOption[]
}

export interface MachshipRoutesResponse {
  id: string
  routes: MachshipSimpleRoute[]
}

/**
 * Request payload for POST /apiv2/consignments/createConsignment
 */
export interface MachshipCreateConsignmentRequest {
  despatchDateTimeLocal?: string
  despatchDateTimeUtc?: string
  customerReference?: string
  customerReference2?: string
  carrierId: number
  carrierServiceId?: number

  // Pickup
  fromName?: string
  fromContact?: string
  fromPhone?: string
  fromEmail?: string
  fromAddressLine1?: string
  fromAddressLine2?: string
  fromLocation: MachshipLocation

  // Delivery
  toName?: string
  toContact?: string
  toPhone?: string
  toEmail?: string
  toAddressLine1?: string
  toAddressLine2?: string
  toLocation: MachshipLocation

  specialInstructions?: string
  questionIds?: number[]

  /** Set to true if any item is dangerous goods */
  dgsDeclaration?: boolean
  limitedQuantityDgsDeclaration?: boolean

  /** Use the requestId from the routes response to lock in the chosen carrier price */
  initialPricingRouteRequestId?: string

  items: MachshipItem[]
}

export interface MachshipCreateConsignmentResponse {
  id: number
  consignmentNumber: string
  despatchDateLocal: string
  despatchDateUtc: string
  etaLocal?: string
  etaUtc?: string
  carrier: MachshipCarrierLite
  isTest: boolean
  carrierConsignmentId: string
  trackingPageAccessToken: string
  consignmentTotal: MachshipConsignmentTotal
}

/**
 * Manifest payload — POST /apiv2/manifests/manifest
 */
export interface MachshipManifestRequest {
  companyId?: number
  consignmentIds: number[]
  pickupDateTime?: string
  pickupSpecialInstructions?: string
  pickupAlreadyBooked?: boolean
  dgsDeclaration?: boolean
}

export interface MachshipManifestResponse {
  id?: number
  consignmentIds?: number[]
}

/**
 * Tracking — GET /apiv2/consignments/getConsignment?id={id}
 */
export interface MachshipConsignmentTrackingStatus {
  id: number
  name: string
  description: string
}

export interface MachshipConsignmentDetail {
  id: number
  consignmentNumber: string
  carrierConsignmentId?: string
  status?: MachshipConsignmentTrackingStatus
  trackingPageAccessToken?: string
  despatchDateLocal?: string
  despatchDateUtc?: string
  etaLocal?: string
  etaUtc?: string
  carrier?: MachshipCarrierLite
}

// ============================================================
// Internal HTTP helper
// ============================================================

async function machshipRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const { baseUrl, token } = getConfig()
  const url = `${baseUrl}${path}`

  const res = await fetch(url, {
    method,
    headers: {
      // Machship uses a custom `token` header, NOT Authorization: Bearer
      token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[Machship ${method} ${path}] failed (${res.status}):`, text)
    throw new MacShipError(
      res.status,
      `Machship ${method} ${path} failed (${res.status}): ${text}`,
      text,
    )
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new MacShipError(
      res.status,
      `Machship ${method} ${path} returned non-JSON: ${text}`,
      text,
    )
  }
}

/** Unwrap the BaseDomainEntityV2 envelope returned by most endpoints */
function unwrap<T>(response: MachshipResponse<T>): T {
  if (response.errors && response.errors.length > 0) {
    const messages = response.errors
      .map((e) => e.errorMessage ?? e.message ?? JSON.stringify(e))
      .join("; ")
    throw new MacShipError(422, `Machship returned errors: ${messages}`)
  }
  if (!response.object) {
    throw new MacShipError(500, "Machship returned an empty response object")
  }
  return response.object
}

// ============================================================
// Public API functions
// ============================================================

/**
 * Get available carrier routes and pricing for a shipment.
 * POST /apiv2/routes/returnroutes
 */
export async function getRoutes(
  request: MachshipRouteRequest,
): Promise<MachshipRoutesResponse> {
  const response = await machshipRequest<MachshipResponse<MachshipRoutesResponse>>(
    "POST",
    "/apiv2/routes/returnroutes",
    request,
  )
  return unwrap(response)
}

/**
 * Create a consignment (booking) with a carrier.
 * POST /apiv2/consignments/createConsignment
 */
export async function createConsignment(
  request: MachshipCreateConsignmentRequest,
): Promise<MachshipCreateConsignmentResponse> {
  const response = await machshipRequest<
    MachshipResponse<MachshipCreateConsignmentResponse>
  >("POST", "/apiv2/consignments/createConsignment", request)
  return unwrap(response)
}

/**
 * Update the despatch date on an existing **unmanifested** consignment.
 *
 * Uses a two-step approach:
 *   1. GET /apiv2/consignments/getUnmanifestedConsignmentForEdit?id={id}
 *      → returns the full edit payload with all required fields
 *   2. POST /apiv2/consignments/editUnmanifestedConsignment
 *      → sends the same payload back with only despatchDateTimeLocal changed
 *
 * Machship's edit endpoint is a full replace — you must send from/to locations,
 * carrier, and items even if you only want to change the date.
 *
 * Returns true on success.
 */
export async function updateConsignmentPickupDate(
  consignmentId: number | string,
  newDateIso: string,
): Promise<boolean> {
  try {
    const id =
      typeof consignmentId === "string"
        ? parseInt(consignmentId, 10)
        : consignmentId
    if (Number.isNaN(id)) return false

    // 1. Fetch the existing consignment in edit format
    const existing = await machshipRequest<
      MachshipResponse<Record<string, unknown>>
    >("GET", `/apiv2/consignments/getUnmanifestedConsignmentForEdit?id=${id}`)

    const obj = existing.object
    if (!obj) {
      console.error(
        `[Machship] getUnmanifestedConsignmentForEdit returned null for ${id}`,
      )
      return false
    }

    // 2. Extract the fields Machship requires for the edit payload
    const fromLoc = obj.fromLocationV1 as
      | { suburb: string; postcode: string }
      | undefined
    const toLoc = obj.toLocationV1 as
      | { suburb: string; postcode: string }
      | undefined
    const carrier = obj.carrier as { id: number } | undefined
    const carrierService = obj.carrierService as { id: number } | undefined
    const carrierAccount = obj.carrierAccount as { id: number } | undefined
    const existingItems = (obj.items ?? []) as Array<Record<string, unknown>>

    // 3. Rebuild items in the edit format (standardItem nesting)
    const editItems = existingItems.map((item) => {
      const machshipItemType = item.machshipItemType as
        | { id: number }
        | undefined
      const stdItem = item.standardItem as
        | { height: number; weight: number; length: number; width: number }
        | undefined
      return {
        id: item.id,
        standardItemId: item.standardItemId,
        itemType: machshipItemType?.id ?? 1,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        palletSpaces: item.palletSpaces,
        standardItem: stdItem ?? {
          height: (item.height as number) ?? 40,
          weight: (item.weight as number) ?? 25,
          length: (item.length as number) ?? 30,
          width: (item.width as number) ?? 30,
        },
      }
    })

    const companyId =
      process.env.MACSHIP_COMPANY_ID
        ? parseInt(process.env.MACSHIP_COMPANY_ID, 10)
        : undefined

    // 4. Send the edit with the new despatch date
    const editPayload = {
      id,
      companyId,
      despatchDateTimeLocal: `${newDateIso}T08:00:00`,
      fromLocation: fromLoc
        ? { suburb: fromLoc.suburb, postcode: fromLoc.postcode }
        : undefined,
      fromAddressLine1: (obj.fromAddressLine1 as string) || "",
      toLocation: toLoc
        ? { suburb: toLoc.suburb, postcode: toLoc.postcode }
        : undefined,
      toAddressLine1: (obj.toAddressLine1 as string) || "",
      carrierId: carrier?.id,
      carrierServiceId: carrierService?.id,
      carrierAccountId: carrierAccount?.id,
      items: editItems,
    }

    await machshipRequest<MachshipResponse<unknown>>(
      "POST",
      "/apiv2/consignments/editUnmanifestedConsignment",
      editPayload,
    )
    // Note: Machship returns "Consignment Saved Successfully" in the errors
    // array — this is an informational message, not a real error.

    return true
  } catch (err) {
    console.error("[Machship] updateConsignmentPickupDate failed:", err)
    return false
  }
}

/**
 * Manifest one or more consignments (finalises them for pickup).
 * POST /apiv2/manifests/manifest
 */
export async function manifestConsignments(
  consignmentIds: Array<number | string>,
  options: { pickupDateTime?: string; specialInstructions?: string } = {},
): Promise<MachshipManifestResponse> {
  const ids = consignmentIds
    .map((id) => (typeof id === "string" ? parseInt(id, 10) : id))
    .filter((id): id is number => !Number.isNaN(id))

  // Machship's manifest endpoint expects an ARRAY of BookedManifestV2 objects,
  // not a single object. One array entry = one manifest (pickup) booking.
  // companyId is required on each entry so Machship knows which company's
  // carrier accounts to manifest against.
  const companyId = process.env.MACSHIP_COMPANY_ID
    ? parseInt(process.env.MACSHIP_COMPANY_ID, 10)
    : undefined
  const payload: MachshipManifestRequest[] = [
    {
      companyId,
      consignmentIds: ids,
      pickupDateTime: options.pickupDateTime,
      pickupSpecialInstructions: options.specialInstructions,
    },
  ]

  const response = await machshipRequest<MachshipResponse<MachshipManifestResponse>>(
    "POST",
    "/apiv2/manifests/manifest",
    payload,
  )
  // Manifest endpoint may return data directly or wrapped — handle both
  if (response && typeof response === "object" && "object" in response) {
    return unwrap(response)
  }
  return response as unknown as MachshipManifestResponse
}

/**
 * Get tracking/status for a consignment.
 * GET /apiv2/consignments/getConsignment?id={id}
 */
export async function getConsignment(
  consignmentId: number | string,
): Promise<MachshipConsignmentDetail> {
  const id = typeof consignmentId === "string" ? parseInt(consignmentId, 10) : consignmentId
  if (Number.isNaN(id)) {
    throw new MacShipError(400, `Invalid consignment id: ${consignmentId}`)
  }
  const response = await machshipRequest<
    MachshipResponse<MachshipConsignmentDetail>
  >("GET", `/apiv2/consignments/getConsignment?id=${id}`)
  return unwrap(response)
}

/**
 * Build the URL for the consignment label PDF.
 * GET /apiv2/labels/getConsignmentPdf?consignmentId={id}
 *
 * The endpoint requires the `token` header — fetch it server-side and proxy
 * the PDF rather than redirecting the browser to this URL.
 */
export function getLabelsUrl(consignmentId: number | string): string {
  const { baseUrl } = getConfig()
  return `${baseUrl}/apiv2/labels/getConsignmentPdf?consignmentId=${consignmentId}`
}

/**
 * Returns the raw token (for use in authorised proxy requests like /api/macship/labels).
 * This is server-side only — never expose to the client.
 */
export function getMachshipToken(): string {
  return getConfig().token
}

// ============================================================
// Configuration check helper
// ============================================================

/**
 * Returns true if the required Machship API token env var is set.
 */
export function isMacShipConfigured(): boolean {
  const mode = (process.env.MACSHIP_MODE ?? "test").toLowerCase()
  const isProduction = mode === "production"
  const token = isProduction
    ? process.env.MACSHIP_PRODUCTION_API_TOKEN
    : process.env.MACSHIP_TEST_API_TOKEN
  return Boolean(token)
}
