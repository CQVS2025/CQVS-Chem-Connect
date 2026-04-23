/**
 * Structured logger for GHL webhook routes.
 *
 * Produces a consistently-formatted, grep-friendly multi-line log entry
 * so it's obvious when a webhook fires, which route it hit, and what it
 * contained. Only used server-side; safe to import into webhook routes.
 *
 * Example output:
 *   ========== [GHL events] ❌ unknown event type ==========
 *     raw_type      : undefined
 *     received_keys : ["contact_id","location_id","message_id","type"]
 *     full_payload  : { ... }
 *     hint          : Set the GHL workflow webhook's Custom Data ...
 *   =======================================================
 */

export function logWebhook(
  route:
    | "contacts"
    | "events"
    | "conversations"
    | "lc-email-stats"
    | "oauth",
  headline: string,
  details: Record<string, unknown> = {},
): void {
  const bar = "=".repeat(55)
  const prefix = `[GHL ${route}]`
  // eslint-disable-next-line no-console
  console.log(
    `\n${bar}\n ${prefix} ${headline}  @ ${new Date().toISOString()}\n${bar}`,
  )
  for (const [key, value] of Object.entries(details)) {
    // eslint-disable-next-line no-console
    console.log(`  ${key.padEnd(16)}: ${stringify(value)}`)
  }
  // eslint-disable-next-line no-console
  console.log(`${bar}\n`)
}

function stringify(value: unknown): string {
  if (value === undefined) return "undefined"
  if (value === null) return "null"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean")
    return String(value)
  try {
    const json = JSON.stringify(value, null, 2)
    // Indent subsequent lines so the whole object sits under the key label.
    return json.split("\n").join("\n                    ")
  } catch {
    return String(value)
  }
}
