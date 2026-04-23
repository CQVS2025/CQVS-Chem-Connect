/**
 * Marketing module error alerting.
 *
 * Thin wrapper around the existing Mailgun `sendEmail()` helper. Reads the
 * `support_email` admin setting as the recipient. Throttled in-memory so a
 * GHL outage doesn't flood the inbox (one alert per action per 15 min).
 */

import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendEmail } from "@/lib/email/send"

const COOLDOWN_MS = 15 * 60 * 1000
const lastSent = new Map<string, number>()

export interface AlertOptions {
  /** Short machine key for throttling (e.g. "ghl.auth_failed"). */
  key: string
  subject: string
  /** Plain-text body; will be formatted into the admin email template. */
  body: string
}

export async function sendMarketingAlert(options: AlertOptions): Promise<void> {
  const now = Date.now()
  const prev = lastSent.get(options.key) ?? 0
  if (now - prev < COOLDOWN_MS) return
  lastSent.set(options.key, now)

  try {
    const supabase = createServiceRoleClient()
    const { data: row } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "support_email")
      .maybeSingle()
    const to = (row?.value as string | undefined) ?? "support@cqvs.com.au"

    await sendEmail({
      to,
      subject: `[Marketing alert] ${options.subject}`,
      heading: "Marketing module alert",
      preheader: options.subject,
      sections: [
        {
          title: options.subject,
          content: options.body,
        },
        {
          content:
            "Further alerts for the same event type are suppressed for 15 minutes.",
        },
      ],
      footerNote:
        "You're receiving this because you're set as the support contact for Chem Connect.",
    })
  } catch (err) {
    // Alerting must never throw back into the caller.
    console.error("[marketing alerts] send failed", err)
  }
}
