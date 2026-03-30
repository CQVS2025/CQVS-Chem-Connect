import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { sendEmail, isEmailEnabled, getAdminSettings } from "@/lib/email/send"

export async function POST(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { product_id, product_name, product_slug } = body

  // Read configurable limit from admin settings
  const settings = await getAdminSettings()
  const earlyAccessLimit = parseInt(settings.early_access_limit || "20") || 20

  if (!product_id || !product_name) {
    return NextResponse.json(
      { error: "product_id and product_name are required" },
      { status: 400 }
    )
  }

  // Check if email is enabled
  const emailEnabled = await isEmailEnabled()
  if (!emailEnabled) {
    return NextResponse.json(
      { error: "Email notifications are disabled. Enable them in Settings." },
      { status: 400 }
    )
  }

  // Fetch early access signups - first 20 only
  const { data: signups, error: fetchError } = await supabase
    .from("early_access_signups")
    .select("id, email, product_slug")
    .order("created_at", { ascending: true })
    .limit(earlyAccessLimit)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!signups || signups.length === 0) {
    return NextResponse.json(
      { error: "No early access signups to notify" },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const productUrl = `${appUrl}/products/${product_slug || product_id}`

  let sent = 0
  let failed = 0

  for (const signup of signups) {
    try {
      const success = await sendEmail({
        to: signup.email,
        subject: `${product_name} is Now Available - Chem Connect`,
        heading: `${product_name} Has Launched!`,
        preheader: `${product_name} is now available on Chem Connect. You've earned a free 200L drum as an early access member.`,
        sections: [
          {
            title: "Your Early Access Reward",
            content: `
              <p>Great news! <strong>${product_name}</strong> is now live on Chem Connect.</p>
              <p>Because you were one of the <strong>first ${earlyAccessLimit} customers</strong> to sign up for early access, you've earned a <strong>free 200L drum of ${product_name}</strong>.</p>
            `,
          },
          {
            title: "What Happens Next",
            content: `
              <ul style="padding-left: 20px; margin: 0;">
                <li>Our team will reach out to you shortly to arrange your free 200L drum</li>
                <li>No code or minimum order needed - this is our thank you for being an early supporter</li>
                <li>In the meantime, you can check out ${product_name} on our website</li>
              </ul>
            `,
          },
        ],
        ctaButton: {
          text: `View ${product_name}`,
          url: productUrl,
        },
        footerNote:
          `You're receiving this because you signed up for early access on Chem Connect. This reward is available to the first ${earlyAccessLimit} customers only.`,
      })

      if (success) {
        sent++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return NextResponse.json({
    sent,
    failed,
    total: signups.length,
    message: `Notified ${sent} of ${signups.length} early access customers about ${product_name}.`,
  })
}
