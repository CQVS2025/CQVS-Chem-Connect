/**
 * Single insertion point for integration_log rows.
 *
 * Two entry points:
 *   - logIntegrationCall  → for HTTP wrappers (xeroRequest, machshipRequest)
 *                           that pass status/headers/body and let us classify.
 *   - logIntegrationEvent → for higher-level "this happened" rows (token
 *                           refreshed, OAuth callback completed, quote
 *                           summary, etc.) where the caller already knows
 *                           the outcome.
 *
 * Both writes are best-effort: if Supabase is down or the row fails to
 * insert, we log to console and swallow — never block the user request.
 */

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getIntegrationContext } from "./context"
import { redact, safeBody } from "./redact"
import type { ErrorCategory } from "./classify"

export type Integration = "xero" | "macship"
export type LogStatus = "success" | "error" | "warning"

export interface LogIntegrationCallInput {
  integration: Integration
  endpoint: string
  method: string
  httpStatus: number
  durationMs?: number
  status: LogStatus
  errorCategory?: ErrorCategory | null
  errorCode?: string | null
  errorMessage?: string | null

  // The response & request the wrapper observed. Pass parsed JSON when
  // available; raw text otherwise (we'll JSON-decode best-effort).
  requestPayload?: unknown
  responsePayload?: unknown
  responseBodyText?: string | null
  responseHeaders?: Record<string, string>

  // Backwards-compat fields preserved on the table for the existing
  // /admin/xero UI; safe to leave undefined.
  entityType?: string | null
  entityId?: string | null
  xeroId?: string | null
  action?: string | null

  // Per-call metadata that doesn't already live in the active context.
  metadata?: Record<string, unknown>

  // Override context fields when truly needed (e.g. token refresh cron
  // that has no user/order). Otherwise leave undefined and we'll pull
  // from the AsyncLocalStorage scope.
  correlationId?: string | null
  userId?: string | null
  orderId?: string | null
}

export interface LogIntegrationEventInput {
  integration: Integration
  action: string // e.g. "token_refresh", "quote_summary", "callback"
  status: LogStatus
  errorCategory?: ErrorCategory | null
  errorCode?: string | null
  errorMessage?: string | null
  endpoint?: string
  entityType?: string | null
  entityId?: string | null
  xeroId?: string | null
  requestPayload?: unknown
  responsePayload?: unknown
  metadata?: Record<string, unknown>
  correlationId?: string | null
  userId?: string | null
  orderId?: string | null
}

export async function logIntegrationCall(
  input: LogIntegrationCallInput,
): Promise<void> {
  const ctx = getIntegrationContext()
  const ctxMetadata = ctx?.metadata
  const merged: Record<string, unknown> | undefined =
    input.metadata || ctxMetadata
      ? { ...(ctxMetadata ?? {}), ...(input.metadata ?? {}) }
      : undefined

  const responsePayload =
    input.responsePayload !== undefined
      ? input.responsePayload
      : safeBody(input.responseBodyText ?? null)

  await insert({
    integration: input.integration,
    endpoint: stripQuery(input.endpoint),
    method: input.method,
    http_status: input.httpStatus,
    duration_ms: input.durationMs ?? null,
    status: input.status,
    error_category: input.errorCategory ?? null,
    error_code: input.errorCode ?? null,
    error_message: truncate(input.errorMessage ?? null, 4000),
    correlation_id:
      input.correlationId !== undefined
        ? input.correlationId
        : ctx?.correlationId ?? null,
    user_id: input.userId !== undefined ? input.userId : ctx?.userId ?? null,
    order_id:
      input.orderId !== undefined ? input.orderId : ctx?.orderId ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    xero_id: input.xeroId ?? null,
    action: input.action ?? null,
    request_payload: input.requestPayload != null ? redact(input.requestPayload) : null,
    response_payload: responsePayload != null ? redact(responsePayload) : null,
    response_headers: input.responseHeaders ?? null,
    metadata: merged ?? null,
  })
}

export async function logIntegrationEvent(
  input: LogIntegrationEventInput,
): Promise<void> {
  const ctx = getIntegrationContext()
  const ctxMetadata = ctx?.metadata
  const merged: Record<string, unknown> | undefined =
    input.metadata || ctxMetadata
      ? { ...(ctxMetadata ?? {}), ...(input.metadata ?? {}) }
      : undefined

  await insert({
    integration: input.integration,
    endpoint: input.endpoint ? stripQuery(input.endpoint) : `event:${input.action}`,
    method: "EVENT",
    http_status: 0,
    duration_ms: null,
    status: input.status,
    error_category: input.errorCategory ?? null,
    error_code: input.errorCode ?? null,
    error_message: truncate(input.errorMessage ?? null, 4000),
    correlation_id:
      input.correlationId !== undefined
        ? input.correlationId
        : ctx?.correlationId ?? null,
    user_id: input.userId !== undefined ? input.userId : ctx?.userId ?? null,
    order_id:
      input.orderId !== undefined ? input.orderId : ctx?.orderId ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    xero_id: input.xeroId ?? null,
    action: input.action,
    request_payload: input.requestPayload != null ? redact(input.requestPayload) : null,
    response_payload:
      input.responsePayload != null ? redact(input.responsePayload) : null,
    response_headers: null,
    metadata: merged ?? null,
  })
}

interface Row {
  integration: Integration
  endpoint: string
  method: string
  http_status: number
  duration_ms: number | null
  status: LogStatus
  error_category: ErrorCategory | null
  error_code: string | null
  error_message: string | null
  correlation_id: string | null
  user_id: string | null
  order_id: string | null
  entity_type: string | null
  entity_id: string | null
  xero_id: string | null
  action: string | null
  request_payload: unknown
  response_payload: unknown
  response_headers: Record<string, string> | null
  metadata: Record<string, unknown> | null
}

async function insert(row: Row): Promise<void> {
  try {
    const supabase = createServiceRoleClient()
    const { error } = await supabase.from("integration_log").insert(row)
    if (error) {
      console.error("[integration-log] insert failed:", error.message)
    }
  } catch (err) {
    console.error("[integration-log] insert threw:", err)
  }
}

function stripQuery(endpoint: string): string {
  const q = endpoint.indexOf("?")
  return q === -1 ? endpoint : endpoint.slice(0, q)
}

function truncate(s: string | null, max: number): string | null {
  if (s == null) return null
  if (s.length <= max) return s
  return s.slice(0, max - 3) + "..."
}
