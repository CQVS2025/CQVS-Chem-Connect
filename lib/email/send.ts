import { createClient } from "@supabase/supabase-js"
import { buildEmailHtml } from "./template"

interface SendEmailOptions {
  to: string
  subject: string
  heading: string
  preheader?: string
  sections: { title?: string; content: string }[]
  ctaButton?: { text: string; url: string }
  footerNote?: string
}

/**
 * Send an email via Mailgun REST API.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { to, subject, heading, preheader, sections, ctaButton, footerNote } =
    options

  const apiKey = process.env.MAILGUN_API_KEY
  const domain = process.env.MAILGUN_DOMAIN
  const rawBaseUrl =
    process.env.MAILGUN_BASE_URL || "https://api.mailgun.net"
  // Ensure /v3 is in the path
  const baseUrl = rawBaseUrl.endsWith("/v3")
    ? rawBaseUrl
    : `${rawBaseUrl.replace(/\/+$/, "")}/v3`

  if (!apiKey || !domain) {
    console.error(
      "Mailgun not configured - missing MAILGUN_API_KEY or MAILGUN_DOMAIN",
    )
    return false
  }

  // Fetch the support email from admin settings so it appears in the footer
  let supportEmail = ""
  try {
    const settings = await getAdminSettings()
    supportEmail = settings.support_email || ""
  } catch {
    // Non-blocking - footer will just not show the support email
  }

  const html = buildEmailHtml({
    subject,
    heading,
    preheader,
    sections,
    ctaButton,
    footerNote,
    supportEmail,
  })

  const form = new URLSearchParams()
  form.append("from", `Chem Connect <noreply@${domain}>`)
  form.append("to", to)
  form.append("subject", subject)
  form.append("html", html)

  const credentials = Buffer.from(`api:${apiKey}`).toString("base64")

  try {
    const response = await fetch(`${baseUrl}/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(
        `Mailgun send failed (${response.status}): ${errorText}`,
      )
      return false
    }

    return true
  } catch (error) {
    console.error("Mailgun send error:", error)
    return false
  }
}

/**
 * Create a Supabase admin client using the service role key (bypasses RLS).
 */
function createAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Fetch all admin settings from the settings table as a key-value map.
 */
export async function getAdminSettings(): Promise<Record<string, string>> {
  try {
    const supabase = createAdminSupabase()
    const { data, error } = await supabase.from("admin_settings").select("key, value")

    if (error) {
      console.error("Failed to fetch admin settings:", error.message)
      return {}
    }

    const settings: Record<string, string> = {}
    for (const row of data ?? []) {
      settings[row.key] = row.value
    }
    return settings
  } catch (error) {
    console.error("Error fetching admin settings:", error)
    return {}
  }
}

/**
 * Check whether admin email notifications are enabled.
 */
export async function isEmailEnabled(): Promise<boolean> {
  const settings = await getAdminSettings()
  return settings.email_notifications_enabled === "true"
}

/**
 * Get the admin support email from settings.
 */
export async function getAdminEmail(): Promise<string> {
  const settings = await getAdminSettings()
  return settings.support_email || ""
}
