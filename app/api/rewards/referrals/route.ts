import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled, getAdminEmail } from "@/lib/email/send"

export async function GET() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: referrals, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(referrals)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { referrerName, referredSiteName, contactPerson, referredEmail, phone } = body

  if (!referrerName || !referredSiteName || !contactPerson || !phone) {
    return NextResponse.json(
      { error: "All required fields must be filled" },
      { status: 400 }
    )
  }

  if (typeof phone !== "string" || phone.length < 8) {
    return NextResponse.json(
      { error: "Please enter a valid phone number" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("referrals")
    .insert({
      referrer_id: user.id,
      referrer_name: referrerName,
      referred_site_name: referredSiteName,
      referred_contact_name: contactPerson,
      referred_email: referredEmail || null,
      referred_phone: phone,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Send intro email to the referred person (non-blocking)
  if (referredEmail) {
    const emailEnabled = await isEmailEnabled()
    if (emailEnabled) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

      sendEmail({
        to: referredEmail,
        subject: `${referrerName} thinks you should check out Chem Connect`,
        heading: "You've Been Referred!",
        preheader: `${referrerName} thinks Chem Connect could save your site money on chemicals.`,
        sections: [
          {
            title: `${referrerName} Referred You`,
            content: `
              <p>Hi ${contactPerson},</p>
              <p><strong>${referrerName}</strong> thinks you should check out <strong>Chem Connect</strong> - a B2B chemical marketplace built for concrete plants and quarries.</p>
              <p>We supply industrial chemicals directly from manufacturers at competitive prices, with fast delivery across Australia.</p>
            `,
          },
          {
            title: "Why Sites Switch to Us",
            content: `
              <ul style="padding-left: 20px; margin: 0;">
                <li>Manufacturer-direct pricing - no middleman markup</li>
                <li>Full range: truck wash, acid replacements, degreasers, and more</li>
                <li>Safety Data Sheets available for every product</li>
                <li>Simple online ordering with order tracking</li>
                <li>Rewards program with volume discounts and free product</li>
              </ul>
            `,
          },
          {
            content: `
              <p>Our team will be in touch shortly to see if we can help your site. In the meantime, feel free to browse our product range.</p>
            `,
          },
        ],
        ctaButton: {
          text: "Browse Products",
          url: `${appUrl}/products`,
        },
        footerNote: `You're receiving this because ${referrerName} referred you via Chem Connect. We'll only email you this once.`,
      }).catch(() => {
        // Non-blocking - don't fail the referral if email fails
      })
    }
  }

  // Notify admin about new referral (non-blocking)
  const emailEnabled = referredEmail ? true : await isEmailEnabled()
  if (emailEnabled) {
    const adminEmail = await getAdminEmail()
    if (adminEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      sendEmail({
        to: adminEmail,
        subject: `New Referral Submitted - ${referredSiteName}`,
        heading: "New Referral Received",
        preheader: `${referrerName} has referred ${referredSiteName} via Chem Connect.`,
        sections: [
          {
            title: "Referral Details",
            content: `
              <p><strong>Referred by:</strong> ${referrerName}</p>
              <p><strong>Site name:</strong> ${referredSiteName}</p>
              <p><strong>Contact person:</strong> ${contactPerson}</p>
              <p><strong>Phone:</strong> ${phone}</p>
              ${referredEmail ? `<p><strong>Email:</strong> ${referredEmail}</p>` : ""}
              ${referredEmail ? `<p style="color: #52c77d; font-size: 13px;">An intro email has been automatically sent to ${contactPerson}.</p>` : `<p style="color: #94a3b8; font-size: 13px;">No email provided - manual outreach required.</p>`}
            `,
          },
        ],
        ctaButton: {
          text: "View in Admin",
          url: `${appUrl}/admin/rewards`,
        },
        footerNote: "You're receiving this because a new referral was submitted on Chem Connect.",
      }).catch(() => {})
    }
  }

  return NextResponse.json(data, { status: 201 })
}
