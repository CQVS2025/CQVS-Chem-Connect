/**
 * Merge tag / personalization variable substitution for campaigns.
 *
 * Matches GHL's `{{tag}}` syntax so Claude-generated templates that use
 * GHL conventions work without modification. Applied per-recipient by
 * the dispatcher at send time to subject / body_html / body_text, and by
 * test-send against the chosen test contact.
 *
 * Fallback cascade (in priority order):
 *   1. Contact data (with cascading for name-like tags — see resolve() below)
 *   2. Inline override in the template: `{{first_name | friend}}`
 *      (an explicit empty override `{{first_name | }}` renders "")
 *   3. Smart default baked in per-tag (e.g. first_name → "there")
 *   4. Empty string
 *
 * This gives authors a "Gmail compose" experience — the common case just
 * reads naturally — while allowing per-use overrides when a different
 * tone is wanted for a specific campaign.
 */

export interface MergeTagContext {
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  state: string | null
  country: string | null
}

export type MergeTagKey = keyof MergeTagContext

/**
 * Per-tag smart defaults — used when the contact is missing this field
 * AND the template didn't provide an inline `{{tag | …}}` override.
 * Chosen to read naturally in common greeting/closing positions.
 */
const SMART_DEFAULT: Record<MergeTagKey, string> = {
  first_name: "there",
  last_name: "",
  full_name: "there",
  email: "",
  phone: "",
  company_name: "your business",
  state: "",
  country: "",
}

/**
 * Public registry — drives the UI chips and documents each tag. The
 * `smartDefault` is surfaced in hover tooltips so authors know what to
 * expect when a contact is missing that field.
 */
export const MERGE_TAGS: ReadonlyArray<{
  id: MergeTagKey
  label: string
  description: string
  example: string
  smartDefault: string
}> = [
  {
    id: "first_name",
    label: "{{first_name}}",
    description: "Contact's first name (cascades to full_name's first token)",
    example: "Jonny",
    smartDefault: SMART_DEFAULT.first_name,
  },
  {
    id: "last_name",
    label: "{{last_name}}",
    description: "Contact's last name",
    example: "Harper",
    smartDefault: SMART_DEFAULT.last_name,
  },
  {
    id: "full_name",
    label: "{{full_name}}",
    description: "Full name (cascades to first + last)",
    example: "Jonny Harper",
    smartDefault: SMART_DEFAULT.full_name,
  },
  {
    id: "email",
    label: "{{email}}",
    description: "Email address",
    example: "jonny@example.com",
    smartDefault: SMART_DEFAULT.email,
  },
  {
    id: "phone",
    label: "{{phone}}",
    description: "Phone number",
    example: "+61 4 1234 5678",
    smartDefault: SMART_DEFAULT.phone,
  },
  {
    id: "company_name",
    label: "{{company_name}}",
    description: "Company / organisation name",
    example: "Harper Industries",
    smartDefault: SMART_DEFAULT.company_name,
  },
  {
    id: "state",
    label: "{{state}}",
    description: "State / region",
    example: "QLD",
    smartDefault: SMART_DEFAULT.state,
  },
  {
    id: "country",
    label: "{{country}}",
    description: "Country",
    example: "AU",
    smartDefault: SMART_DEFAULT.country,
  },
] as const

// Matches `{{tag}}` and `{{tag | fallback}}`. The fallback capture is
// optional: undefined when no `|` is present, "" when `{{tag | }}`.
// Fallbacks can contain internal spaces and pipes, up to the closing `}}`.
const TAG_PATTERN = /\{\{\s*([a-z_][a-z0-9_]*)\s*(?:\|\s*(.*?))?\s*\}\}/gi

/**
 * Replace every `{{tag}}` (or `{{tag | fallback}}`) in `input` with the
 * contact's value, falling back per the cascade documented at the top
 * of this file. Unknown tag names are left untouched so typos are
 * visible rather than silently producing empty strings.
 *
 * When `escapeHtml` is true (for body_html), values — including inline
 * fallbacks and smart defaults — are HTML-escaped to defend against
 * injected markup in contact data.
 */
export function substituteMergeTags(
  input: string,
  contact: MergeTagContext,
  { escapeHtml = false }: { escapeHtml?: boolean } = {},
): string {
  if (!input) return input

  return input.replace(
    TAG_PATTERN,
    (match, rawKey: string, inlineFallback: string | undefined) => {
      const key = rawKey.toLowerCase() as MergeTagKey
      if (!(key in SMART_DEFAULT)) return match // typo — leave visible

      const resolved = resolve(key, contact)
      const value =
        resolved ||
        (inlineFallback !== undefined ? inlineFallback : SMART_DEFAULT[key])

      return escapeHtml ? escape(value) : value
    },
  )
}

/**
 * Resolve a single tag against the contact with name-cascades:
 *   first_name  → first_name OR first token of full_name
 *   full_name   → full_name  OR "first_name last_name" OR first_name
 * Other tags map 1:1.
 */
function resolve(key: MergeTagKey, c: MergeTagContext): string {
  switch (key) {
    case "first_name": {
      if (c.first_name) return c.first_name
      if (c.full_name) return c.full_name.trim().split(/\s+/)[0] ?? ""
      return ""
    }
    case "full_name": {
      if (c.full_name) return c.full_name
      const joined = [c.first_name, c.last_name].filter(Boolean).join(" ").trim()
      if (joined) return joined
      return c.first_name ?? ""
    }
    default:
      return c[key] ?? ""
  }
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
