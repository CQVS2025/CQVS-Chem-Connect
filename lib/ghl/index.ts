/**
 * Barrel export for the GoHighLevel client library.
 * Import from "@/lib/ghl" everywhere except for internal files within lib/ghl/.
 */

export { GHL_CONFIG, getGhlConfig } from "./config"
export {
  GHLApiError,
  GHLAuthError,
  GHLNotFoundError,
  GHLRateLimitError,
  isRetryableError,
} from "./errors"
export { ghlFetch } from "./client"
export type { GhlFetchOptions } from "./client"

export * as GhlContacts from "./contacts"
export * as GhlCampaigns from "./campaigns"
export * as GhlConversations from "./conversations"
export * as GhlLocations from "./locations"
export * as GhlWebhooks from "./webhooks"
export * as GhlWorkflows from "./workflows"

export type {
  GhlContact,
  GhlContactInput,
  GhlContactListResponse,
  GhlLocation,
  GhlWorkflow,
  GhlConversation,
  GhlMessage,
  GhlSendSmsInput,
} from "./types"
