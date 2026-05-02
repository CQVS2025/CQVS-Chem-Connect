/**
 * Per-request integration context (AsyncLocalStorage).
 *
 * Set once at an entry point — quote endpoint, orders POST, finalize,
 * admin approve, Stripe webhook — and any downstream Xero or MacShip
 * call automatically picks up correlation_id + user_id + order_id
 * without callers having to plumb arguments through every helper.
 *
 * If no context is set (e.g. a cron sweep that touches Xero), helpers
 * still log the call but with correlation_id null. That's fine —
 * those rows just won't be linked to a customer journey.
 */

import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"

export interface IntegrationContext {
  correlationId: string
  userId?: string | null
  orderId?: string | null
  /**
   * Free-form metadata that gets attached to every log row in this scope.
   * Useful for the quote path to record postcode, item count, etc. once
   * and have it appear on every Machship call automatically.
   */
  metadata?: Record<string, unknown>
}

const storage = new AsyncLocalStorage<IntegrationContext>()

export function getIntegrationContext(): IntegrationContext | undefined {
  return storage.getStore()
}

/**
 * Run `fn` inside a fresh integration context. Generates a correlation_id
 * if one isn't provided.
 */
export function runWithIntegrationContext<T>(
  ctx: Partial<IntegrationContext>,
  fn: () => Promise<T>,
): Promise<T> {
  const merged: IntegrationContext = {
    correlationId: ctx.correlationId ?? randomUUID(),
    userId: ctx.userId ?? null,
    orderId: ctx.orderId ?? null,
    metadata: ctx.metadata,
  }
  return storage.run(merged, fn)
}

/**
 * Mutate the active context's metadata. No-op when called outside a context.
 * Useful when a downstream step learns more (e.g. order_id is created
 * mid-request and we want subsequent calls in the same scope tagged with it).
 */
export function updateIntegrationContext(
  patch: Partial<Omit<IntegrationContext, "correlationId">>,
): void {
  const cur = storage.getStore()
  if (!cur) return
  if (patch.userId !== undefined) cur.userId = patch.userId
  if (patch.orderId !== undefined) cur.orderId = patch.orderId
  if (patch.metadata) {
    cur.metadata = { ...(cur.metadata ?? {}), ...patch.metadata }
  }
}
