/**
 * Phone-number normalisation helpers.
 *
 * Australian-first: accepts `0412...`, `+61412...`, `61412...`, `(02) 1234 5678`
 * and returns E.164 or null. Used by CSV import and webhook ingestion so
 * every row in marketing_contacts.phone is consistent.
 */

const AU_MOBILE = /^(?:\+?61|0)4\d{8}$/
const AU_LANDLINE = /^(?:\+?61|0)[23578]\d{8}$/

export function normaliseAuPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d+]/g, "")
  if (!digits) return null

  // Already E.164 with AU country code
  if (digits.startsWith("+61") && AU_MOBILE.test(digits)) return digits
  if (digits.startsWith("+61") && AU_LANDLINE.test(digits)) return digits

  // Missing + but starts with country code
  if (digits.startsWith("61") && (AU_MOBILE.test("+" + digits) || AU_LANDLINE.test("+" + digits))) {
    return "+" + digits
  }

  // 0-leading national format
  if (digits.startsWith("0") && AU_MOBILE.test(digits)) {
    return "+61" + digits.slice(1)
  }
  if (digits.startsWith("0") && AU_LANDLINE.test(digits)) {
    return "+61" + digits.slice(1)
  }

  // Already E.164 with some other country — pass through untouched if it looks valid
  if (/^\+\d{7,15}$/.test(digits)) return digits

  return null
}

export function normaliseEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim().toLowerCase()
  // Basic shape check — RFC compliance isn't useful here
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
  return trimmed
}
