/**
 * Small disposable-email blocklist used by the public-share submit endpoint.
 *
 * Not exhaustive (no list ever is) - just covers the most common throwaway
 * domains that show up in form-spam attempts. Easy to extend as we see new
 * patterns.
 *
 * Matching is exact suffix-match on the domain part of the email. A user
 * with email "foo@10minutemail.com" gets blocked; "foo@gmail.com" does not.
 */

const DISPOSABLE_DOMAINS = new Set<string>([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "burnermail.io",
  "discard.email",
  "disposablemail.com",
  "dispostable.com",
  "fakemail.net",
  "fakeinbox.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "harakirimail.com",
  "incognitomail.org",
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "maildrop.cc",
  "mintemail.com",
  "moakt.com",
  "mohmal.com",
  "mytrashmail.com",
  "sharklasers.com",
  "spam4.me",
  "spambox.us",
  "spamgourmet.com",
  "tempinbox.com",
  "tempmail.com",
  "tempmail.io",
  "tempmail.net",
  "tempmailaddress.com",
  "throwawaymail.com",
  "trash-mail.com",
  "trashmail.com",
  "trashmail.de",
  "trashmail.io",
  "trashmail.net",
  "yopmail.com",
  "yopmail.net",
])

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Returns null if the email is acceptable, or an error string explaining
 * why it isn't. Caller can return that string straight to the API client.
 */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return "Email is required."
  if (!EMAIL_REGEX.test(trimmed)) return "That doesn't look like a valid email address."

  const domain = trimmed.split("@")[1]
  if (!domain) return "That doesn't look like a valid email address."
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return "Please use a real business email - disposable email services aren't accepted."
  }

  return null
}
