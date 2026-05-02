/**
 * Xero API client.
 *
 * Handles OAuth 2.0 token management (with auto-refresh), tenant ID,
 * and provides typed wrappers for Contacts, Invoices, Purchase Orders,
 * and Attachments.
 *
 * Tokens are stored in the `xero_credentials` table. Access tokens expire
 * in 30 minutes - we refresh them automatically when within 60s of expiry.
 *
 * Usage:
 *   const xero = await getXeroClient()
 *   if (!xero) throw new Error("Xero not connected")
 *   const contact = await xero.createContact({ ... })
 */

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  classifyNetworkError,
  classifyXeroError,
  classifyXeroEmailEndpoint404,
  extractXeroRateHeaders,
  logIntegrationCall,
  logIntegrationEvent,
} from "@/lib/integration-log"

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0"
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize"
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections"

// Xero is migrating from broad scopes to granular scopes.
// Apps created from 2 March 2026 ONLY have the new granular scopes.
// We use the granular scopes since this app was created in 2026.
//
//   Old (deprecated):  accounting.transactions
//   New (granular):    accounting.invoices  (covers Invoices, CreditNotes,
//                                            PurchaseOrders, Quotes, etc.)
//
// `accounting.attachments` is required to upload the customer's PO PDF
// onto the Xero invoice. Without it, invoices are still created and
// emailed but the PDF won't be attached.
export const XERO_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.invoices",
  "accounting.contacts",
  "accounting.attachments",
].join(" ")

export interface XeroCredentialsRow {
  id: string
  tenant_id: string
  tenant_name: string | null
  access_token: string
  refresh_token: string
  expires_at: string
  scope: string | null
}

export interface XeroAddress {
  AddressType?: "STREET" | "POBOX"
  AddressLine1?: string
  AddressLine2?: string
  City?: string
  Region?: string
  PostalCode?: string
  Country?: string
}

export interface XeroPhone {
  PhoneType?: "DEFAULT" | "DDI" | "MOBILE" | "FAX"
  PhoneNumber?: string
  PhoneAreaCode?: string
  PhoneCountryCode?: string
}

export interface XeroContactInput {
  ContactID?: string
  Name: string
  FirstName?: string
  LastName?: string
  EmailAddress?: string
  TaxNumber?: string
  Addresses?: XeroAddress[]
  Phones?: XeroPhone[]
  IsCustomer?: boolean
  IsSupplier?: boolean
}

export interface XeroLineItem {
  Description: string
  Quantity: number
  UnitAmount: number
  AccountCode?: string
  TaxType?: string
  ItemCode?: string
}

export interface XeroInvoiceInput {
  Type: "ACCREC" | "ACCPAY"
  Contact: { ContactID: string }
  LineItems: XeroLineItem[]
  Date: string // YYYY-MM-DD
  DueDate: string // YYYY-MM-DD
  Reference?: string
  InvoiceNumber?: string
  Status?: "DRAFT" | "SUBMITTED" | "AUTHORISED"
  LineAmountTypes?: "Exclusive" | "Inclusive" | "NoTax"
  // Explicit AUD — prevents silent currency mismatch if org settings change
  CurrencyCode?: string
  Url?: string
}

export interface XeroPurchaseOrderInput {
  Contact: { ContactID: string }
  LineItems: XeroLineItem[]
  Date: string // YYYY-MM-DD
  DeliveryDate?: string // YYYY-MM-DD
  Reference?: string
  Status?: "DRAFT" | "SUBMITTED" | "AUTHORISED"
  LineAmountTypes?: "Exclusive" | "Inclusive" | "NoTax"
  CurrencyCode?: string
  DeliveryAddress?: string
  AttentionTo?: string
}

interface XeroTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope?: string
}

interface XeroErrorResponse {
  Type?: string
  Message?: string
  ErrorNumber?: number
  Elements?: Array<{
    ValidationErrors?: Array<{ Message: string }>
    LineItems?: Array<{
      ValidationErrors?: Array<{ Message: string }>
    }>
  }>
}

/**
 * Custom error class that carries the raw Xero response body so callers
 * can persist it to the sync log for debugging.
 */
export class XeroApiError extends Error {
  status: number
  rawBody: string
  parsed: XeroErrorResponse | null
  validationDetails: string

  constructor(
    status: number,
    message: string,
    rawBody: string,
    parsed: XeroErrorResponse | null,
    validationDetails: string,
  ) {
    super(message)
    this.name = "XeroApiError"
    this.status = status
    this.rawBody = rawBody
    this.parsed = parsed
    this.validationDetails = validationDetails
  }
}

/**
 * Extract every validation error message from a Xero error response
 * and join them into a single human-readable string.
 */
function extractValidationErrors(err: XeroErrorResponse | null): string {
  if (!err) return ""
  const messages: string[] = []
  if (err.Elements) {
    for (const el of err.Elements) {
      for (const ve of el.ValidationErrors ?? []) {
        if (ve.Message) messages.push(ve.Message)
      }
      for (const li of el.LineItems ?? []) {
        for (const ve of li.ValidationErrors ?? []) {
          if (ve.Message) messages.push(`Line item: ${ve.Message}`)
        }
      }
    }
  }
  return messages.join(" | ")
}

/**
 * Build the Xero authorization URL for the OAuth handshake.
 *
 * Builds the query string manually rather than using URLSearchParams
 * because URLSearchParams encodes spaces as `+`, but Xero's authorization
 * endpoint expects spaces in the `scope` param to be `%20` encoded.
 */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.XERO_CLIENT_ID
  if (!clientId) {
    throw new Error(
      "XERO_CLIENT_ID is not set in environment variables",
    )
  }

  const parts = [
    `response_type=code`,
    `client_id=${encodeURIComponent(clientId)}`,
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    `scope=${encodeURIComponent(XERO_SCOPES)}`,
    `state=${encodeURIComponent(state)}`,
  ]

  const url = `${XERO_AUTH_URL}?${parts.join("&")}`

  // Log so we can see exactly what we're sending to Xero. Strip if noisy.
  console.log("[Xero OAuth] Authorization URL:", url)
  console.log("[Xero OAuth] Scopes requested:", XERO_SCOPES)
  console.log("[Xero OAuth] Redirect URI:", redirectUri)

  return url
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<XeroTokenResponse> {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("Missing XERO_CLIENT_ID or XERO_CLIENT_SECRET")
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Xero token exchange failed: ${text}`)
  }

  return res.json()
}

/**
 * Refresh an access token using the refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<XeroTokenResponse> {
  const clientId = process.env.XERO_CLIENT_ID
  const clientSecret = process.env.XERO_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("Missing XERO_CLIENT_ID or XERO_CLIENT_SECRET")
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Xero token refresh failed: ${text}`)
  }

  return res.json()
}

/**
 * Get the list of tenant connections for the current access token.
 *
 * `id` is the connection ID (distinct from `tenantId`). Use it with
 * `DELETE /connections/{id}` to revoke access to a single org without
 * affecting other orgs authorized under the same grant.
 */
export async function getTenantConnections(
  accessToken: string,
): Promise<
  Array<{
    id: string
    tenantId: string
    tenantName: string
    tenantType: string
  }>
> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Xero connections lookup failed: ${text}`)
  }
  return res.json()
}

/**
 * Delete a single Xero connection (one org) without revoking the whole grant.
 * Other orgs authorized under the same OAuth grant remain connected.
 */
export async function deleteXeroConnection(
  accessToken: string,
  connectionId: string,
): Promise<void> {
  const res = await fetch(`${XERO_CONNECTIONS_URL}/${connectionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(
      `Xero connection delete failed (${res.status}): ${text}`,
    )
  }
}

/**
 * Get the most recently saved Xero credentials, refreshing if expired.
 * Returns null if Xero is not connected.
 */
export async function getActiveCredentials(): Promise<XeroCredentialsRow | null> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from("xero_credentials")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const expiresAt = new Date(data.expires_at).getTime()
  const now = Date.now()

  // If expiring within 60 seconds, refresh
  if (expiresAt - now < 60_000) {
    try {
      const refreshed = await refreshAccessToken(data.refresh_token)
      const newExpiresAt = new Date(
        Date.now() + refreshed.expires_in * 1000,
      ).toISOString()

      const { data: updated, error: updateError } = await supabase
        .from("xero_credentials")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select()
        .single()

      if (updateError) {
        console.error("Failed to persist refreshed Xero token:", updateError)
        await logXeroSync({
          entityType: "connection",
          action: "token_refresh",
          status: "error",
          errorMessage: `Persist refreshed token failed: ${updateError.message}`,
        })
        return null
      }
      await logXeroSync({
        entityType: "connection",
        action: "token_refresh",
        status: "success",
      })
      return updated as XeroCredentialsRow
    } catch (err) {
      // Refresh failures are CRITICAL — once the refresh token is rejected
      // (or the 60-day window expires), every subsequent Xero call will
      // fail until an admin re-connects. Log it visibly.
      const message = err instanceof Error ? err.message : String(err)
      console.error("Xero token refresh failed:", err)
      await logXeroSync({
        entityType: "connection",
        action: "token_refresh",
        status: "error",
        errorMessage: `Xero token refresh failed: ${message}. Admin needs to reconnect at /admin/xero.`,
      })
      return null
    }
  }

  return data as XeroCredentialsRow
}

/**
 * Low-level Xero API request with automatic auth headers.
 *
 * Adds `summarizeErrors=false` to mutating calls so Xero returns
 * per-record validation errors instead of just "A validation exception
 * occurred". The error thrown includes every ValidationError message.
 */
async function xeroRequest<T>(
  creds: XeroCredentialsRow,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE"
    body?: unknown
    query?: Record<string, string>
  } = {},
): Promise<T> {
  const url = new URL(`${XERO_API_BASE}${path}`)
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v)
    }
  }
  // Get detailed per-record errors on writes
  const method = options.method || "GET"
  if (method === "POST" || method === "PUT") {
    url.searchParams.set("summarizeErrors", "false")
  }

  const startedAt = Date.now()

  let res: Response
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${creds.access_token}`,
        "Xero-tenant-id": creds.tenant_id,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch (netErr) {
    const classified = classifyNetworkError(netErr)
    await logIntegrationCall({
      integration: "xero",
      endpoint: path,
      method,
      httpStatus: 0,
      durationMs: Date.now() - startedAt,
      status: "error",
      errorCategory: classified.category,
      errorCode: classified.code,
      errorMessage: classified.message,
      requestPayload: options.body,
    })
    throw new XeroApiError(
      0,
      `Xero ${method} ${path} network error: ${classified.message}`,
      classified.message,
      null,
      classified.message,
    )
  }

  const rateHeaders = extractXeroRateHeaders(res.headers)
  const text = await res.text()

  // -- Non-2xx ---------------------------------------------------------
  if (!res.ok) {
    let err: XeroErrorResponse | null = null
    try {
      err = JSON.parse(text)
    } catch {
      // not JSON
    }
    const validationDetail = extractValidationErrors(err)
    const baseMessage = err?.Message || text
    const fullMessage = validationDetail
      ? `${baseMessage} - ${validationDetail}`
      : baseMessage

    // Special-case: empty 404 from /Email endpoints is almost always
    // "contact has no email"; surface that as its own code.
    const isEmailEndpoint = /\/(?:Invoices|PurchaseOrders)\/[^/]+\/Email$/i.test(path)
    const classified =
      res.status === 404 && isEmailEndpoint && text.trim().length === 0
        ? classifyXeroEmailEndpoint404(text)
        : classifyXeroError(res.status, err, text)

    console.error(`[Xero ${method} ${path}] failed (${res.status}):`, text)
    await logIntegrationCall({
      integration: "xero",
      endpoint: path,
      method,
      httpStatus: res.status,
      durationMs: Date.now() - startedAt,
      status: "error",
      errorCategory: classified.category,
      errorCode: classified.code,
      errorMessage: classified.message,
      requestPayload: options.body,
      responseBodyText: text,
      responseHeaders: rateHeaders,
    })
    throw new XeroApiError(
      res.status,
      `Xero ${method} ${path} failed (${res.status}): ${fullMessage}`,
      text,
      err,
      validationDetail,
    )
  }

  // -- 2xx --------------------------------------------------------------
  // With summarizeErrors=false, Xero returns HTTP 200 even when validation
  // fails on a record, with HasErrors=true and an all-zeros ID. We must
  // detect this and throw so callers don't store the bogus ID.

  let data: unknown
  try {
    data = text.length === 0 ? null : JSON.parse(text)
  } catch {
    await logIntegrationCall({
      integration: "xero",
      endpoint: path,
      method,
      httpStatus: res.status,
      durationMs: Date.now() - startedAt,
      status: "error",
      errorCategory: "unknown",
      errorCode: "NON_JSON_RESPONSE",
      errorMessage: `Non-JSON response from Xero: ${text.slice(0, 200)}`,
      requestPayload: options.body,
      responseBodyText: text,
      responseHeaders: rateHeaders,
    })
    throw new XeroApiError(
      res.status,
      `Xero ${method} ${path} returned non-JSON response: ${text}`,
      text,
      null,
      "",
    )
  }

  const recordKeys = [
    "Invoices",
    "Contacts",
    "PurchaseOrders",
    "CreditNotes",
    "Payments",
  ]
  const dataObj = (data ?? {}) as Record<string, unknown>
  for (const key of recordKeys) {
    const records = dataObj[key]
    if (!Array.isArray(records)) continue
    for (const record of records) {
      const r = record as {
        HasErrors?: boolean
        ValidationErrors?: Array<{ Message: string }>
        StatusAttributeString?: string
      }
      const hasError =
        r.HasErrors === true ||
        r.StatusAttributeString === "ERROR" ||
        (Array.isArray(r.ValidationErrors) && r.ValidationErrors.length > 0)
      if (hasError) {
        const messages = (r.ValidationErrors ?? [])
          .map((v) => v.Message)
          .filter(Boolean)
          .join(" | ")
        await logIntegrationCall({
          integration: "xero",
          endpoint: path,
          method,
          httpStatus: res.status,
          durationMs: Date.now() - startedAt,
          status: "error",
          errorCategory: "validation",
          errorCode: "RECORD_VALIDATION_FAILED",
          errorMessage: messages || "Record validation failed",
          requestPayload: options.body,
          responsePayload: data,
          responseHeaders: rateHeaders,
        })
        throw new XeroApiError(
          res.status,
          `Xero ${method} ${path} record validation failed: ${messages || "Unknown error"}`,
          text,
          {
            Type: "ValidationException",
            Message: messages || "Record validation failed",
            Elements: [{ ValidationErrors: r.ValidationErrors }],
          },
          messages,
        )
      }
    }
  }

  await logIntegrationCall({
    integration: "xero",
    endpoint: path,
    method,
    httpStatus: res.status,
    durationMs: Date.now() - startedAt,
    status: "success",
    requestPayload: options.body,
    responsePayload: data,
    responseHeaders: rateHeaders,
  })

  return data as T
}

/**
 * Public Xero client wrapper.
 */
export interface XeroClient {
  credentials: XeroCredentialsRow
  findContactByEmail(email: string): Promise<{ ContactID: string } | null>
  createContact(input: XeroContactInput): Promise<{ ContactID: string }>
  upsertContactByEmail(input: XeroContactInput): Promise<{ ContactID: string }>
  updateContactById(
    contactId: string,
    fields: Partial<Omit<XeroContactInput, "ContactID">>,
  ): Promise<{ ContactID: string }>
  createInvoice(input: XeroInvoiceInput): Promise<{
    InvoiceID: string
    InvoiceNumber: string
    Status: string
  }>
  createPurchaseOrder(input: XeroPurchaseOrderInput): Promise<{
    PurchaseOrderID: string
    PurchaseOrderNumber: string
    Status: string
  }>
  approvePurchaseOrder(poId: string): Promise<void>
  emailPurchaseOrder(poId: string): Promise<void>
  emailInvoice(invoiceId: string): Promise<void>
  attachFileToInvoice(
    invoiceId: string,
    fileName: string,
    contentType: string,
    fileBuffer: Buffer | ArrayBuffer,
  ): Promise<void>
}

export async function getXeroClient(): Promise<XeroClient | null> {
  const creds = await getActiveCredentials()
  if (!creds) return null

  async function findContactByEmail(
    email: string,
  ): Promise<{ ContactID: string } | null> {
    const where = `EmailAddress="${email.replace(/"/g, '\\"')}"`
    const data = await xeroRequest<{
      Contacts?: Array<{ ContactID: string }>
    }>(creds!, "/Contacts", { query: { where } })
    return data.Contacts?.[0] ?? null
  }

  async function createContact(
    input: XeroContactInput,
  ): Promise<{ ContactID: string }> {
    const data = await xeroRequest<{
      Contacts: Array<{ ContactID: string }>
    }>(creds!, "/Contacts", {
      method: "PUT",
      body: { Contacts: [input] },
    })
    return data.Contacts[0]
  }

  async function upsertContactByEmail(
    input: XeroContactInput,
  ): Promise<{ ContactID: string }> {
    if (input.EmailAddress) {
      const existing = await findContactByEmail(input.EmailAddress)
      if (existing) {
        const data = await xeroRequest<{
          Contacts: Array<{ ContactID: string }>
        }>(creds!, "/Contacts", {
          method: "POST",
          body: {
            Contacts: [{ ...input, ContactID: existing.ContactID }],
          },
        })
        return data.Contacts[0]
      }
    }
    return createContact(input)
  }

  async function updateContactById(
    contactId: string,
    fields: Partial<Omit<XeroContactInput, "ContactID">>,
  ): Promise<{ ContactID: string }> {
    const data = await xeroRequest<{
      Contacts: Array<{ ContactID: string }>
    }>(creds!, "/Contacts", {
      method: "POST",
      body: {
        Contacts: [{ ContactID: contactId, ...fields } as XeroContactInput],
      },
    })
    return data.Contacts[0]
  }

  async function createInvoice(input: XeroInvoiceInput) {
    const data = await xeroRequest<{
      Invoices: Array<{
        InvoiceID: string
        InvoiceNumber: string
        Status: string
      }>
    }>(creds!, "/Invoices", {
      method: "PUT",
      body: { Invoices: [input] },
    })
    return data.Invoices[0]
  }

  /**
   * Tell Xero to email the invoice to the contact.
   *
   * Xero responds with HTTP 204 and an empty body. The invoice must be
   * AUTHORISED and the contact must have an EmailAddress, otherwise Xero
   * returns a 400.
   */
  async function emailInvoice(invoiceId: string): Promise<void> {
    const url = `${XERO_API_BASE}/Invoices/${invoiceId}/Email`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds!.access_token}`,
        "Xero-tenant-id": creds!.tenant_id,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    })
    if (!res.ok && res.status !== 204) {
      const text = await res.text()
      throw new Error(`Xero email invoice failed (${res.status}): ${text}`)
    }
  }

  async function attachFileToInvoice(
    invoiceId: string,
    fileName: string,
    contentType: string,
    fileBuffer: Buffer | ArrayBuffer,
  ): Promise<void> {
    const url = `${XERO_API_BASE}/Invoices/${invoiceId}/Attachments/${encodeURIComponent(fileName)}`
    // Wrap as Blob - widely compatible BodyInit type
    const arrayBuffer =
      fileBuffer instanceof ArrayBuffer
        ? fileBuffer
        : fileBuffer.buffer.slice(
            fileBuffer.byteOffset,
            fileBuffer.byteOffset + fileBuffer.byteLength,
          )
    const blob = new Blob([arrayBuffer as ArrayBuffer], { type: contentType })
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds!.access_token}`,
        "Xero-tenant-id": creds!.tenant_id,
        "Content-Type": contentType,
        Accept: "application/json",
      },
      body: blob,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Xero attach failed: ${text}`)
    }
  }

  async function createPurchaseOrder(input: XeroPurchaseOrderInput) {
    const data = await xeroRequest<{
      PurchaseOrders: Array<{
        PurchaseOrderID: string
        PurchaseOrderNumber: string
        Status: string
      }>
    }>(creds!, "/PurchaseOrders", {
      method: "PUT",
      body: { PurchaseOrders: [input] },
    })
    return data.PurchaseOrders[0]
  }

  async function approvePurchaseOrder(poId: string): Promise<void> {
    await xeroRequest<{
      PurchaseOrders: Array<{ PurchaseOrderID: string; Status: string }>
    }>(creds!, "/PurchaseOrders", {
      method: "POST",
      body: {
        PurchaseOrders: [
          { PurchaseOrderID: poId, Status: "AUTHORISED" },
        ],
      },
    })
  }

  async function emailPurchaseOrder(poId: string): Promise<void> {
    const url = `${XERO_API_BASE}/PurchaseOrders/${poId}/Email`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds!.access_token}`,
        "Xero-tenant-id": creds!.tenant_id,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    })
    if (!res.ok && res.status !== 204) {
      const text = await res.text()
      throw new Error(`Xero email PO failed (${res.status}): ${text}`)
    }
  }

  return {
    credentials: creds,
    findContactByEmail,
    createContact,
    upsertContactByEmail,
    updateContactById,
    createInvoice,
    createPurchaseOrder,
    approvePurchaseOrder,
    emailPurchaseOrder,
    emailInvoice,
    attachFileToInvoice,
  }
}

/**
 * Switch the active Xero tenant on the stored credentials row.
 *
 * If the new tenant differs from the currently stored one, all stored
 * Xero-specific IDs (profiles.xero_contact_id, orders.xero_invoice_* fields)
 * are wiped because they're scoped to the old tenant and won't resolve
 * against the new one.
 */
export async function switchActiveTenant(params: {
  tenantId: string
  tenantName: string
}): Promise<{ changed: boolean }> {
  const supabase = createServiceRoleClient()

  const { data: existing } = await supabase
    .from("xero_credentials")
    .select("id, tenant_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existing) {
    throw new Error("No active Xero credentials to switch tenant on")
  }

  const changed = existing.tenant_id !== params.tenantId

  const { error: updateError } = await supabase
    .from("xero_credentials")
    .update({
      tenant_id: params.tenantId,
      tenant_name: params.tenantName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)

  if (updateError) {
    throw new Error(`Failed to update tenant: ${updateError.message}`)
  }

  if (changed) {
    await supabase
      .from("profiles")
      .update({ xero_contact_id: null })
      .not("xero_contact_id", "is", null)

    await supabase
      .from("orders")
      .update({
        xero_invoice_id: null,
        xero_invoice_number: null,
        xero_invoice_status: null,
        xero_synced_at: null,
      })
      .not("xero_invoice_id", "is", null)

    await logXeroSync({
      entityType: "connection",
      action: "tenant_changed",
      status: "success",
      xeroId: params.tenantId,
      errorMessage: `Switched tenant to ${params.tenantName} - cleared stored xero_contact_id and xero_invoice_id values from the previous tenant.`,
    })
  }

  return { changed }
}

/**
 * Log a Xero sync attempt for admin visibility / debugging.
 */
/**
 * Higher-level "what we did with Xero" event log.
 *
 * Distinct from xeroRequest's auto-logging: that captures one row per
 * outbound HTTP call. logXeroSync captures one row per *workflow step*
 * (contact synced, invoice attached, PO emailed, token refreshed, etc.) —
 * the level that's useful for an admin scanning recent activity.
 *
 * Writes to the unified integration_log so /admin/integration-logs and
 * the existing /admin/xero view can pull from one place.
 *
 * Best-effort: never blocks the calling flow.
 */
export async function logXeroSync(entry: {
  entityType: string
  entityId?: string | null
  action: string
  status: "success" | "error"
  xeroId?: string | null
  errorMessage?: string | null
  request?: unknown
  response?: unknown
}): Promise<void> {
  // Map status to the unified table's allowed values (which include 'warning').
  const status: "success" | "error" = entry.status

  // Best-effort error categorization for events. Keeping it conservative:
  // if the caller already passed an error string we infer the bucket from
  // recognizable substrings; otherwise leave null.
  let errorCategory: "auth" | "validation" | "business" | "network" | null = null
  let errorCode: string | null = null
  if (entry.errorMessage) {
    const m = entry.errorMessage
    if (/AuthenticationUnsuccessful|Unauthorized|token refresh/i.test(m)) {
      errorCategory = "auth"
      errorCode = "AUTH_FAILURE"
    } else if (/ValidationException|already assigned|validation failed/i.test(m)) {
      errorCategory = "validation"
      errorCode = "VALIDATION_FAILED"
    } else if (/no email|EmailAddress|warehouse.*Xero contact/i.test(m)) {
      errorCategory = "business"
      errorCode = "PO_CONTACT_NO_EMAIL"
    } else if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(m)) {
      errorCategory = "network"
      errorCode = "NET_FETCH_FAILED"
    }
  }

  try {
    await logIntegrationEvent({
      integration: "xero",
      // Keep the bare action so the existing /admin/xero UI renders
      // "{entity_type} - {action}" (e.g. "invoice - create") just like
      // the legacy xero_sync_log shape.
      action: entry.action,
      status,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      xeroId: entry.xeroId ?? null,
      errorCategory,
      errorCode,
      errorMessage: entry.errorMessage ?? null,
      requestPayload: entry.request,
      responsePayload: entry.response,
    })
  } catch (err) {
    console.error("Failed to write integration_log (xero event):", err)
  }
}
