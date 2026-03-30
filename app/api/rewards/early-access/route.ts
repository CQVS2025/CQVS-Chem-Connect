import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendEmail, isEmailEnabled, getAdminEmail } from "@/lib/email/send"

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { email, productSlug } = body

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("early_access_signups")
    .upsert(
      {
        email,
        user_id: user.id,
        product_slug: productSlug || null,
      },
      { onConflict: "email,product_slug" }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify admin about new early access signup (non-blocking)
  const emailEnabled = await isEmailEnabled()
  if (emailEnabled) {
    const adminEmail = await getAdminEmail()
    if (adminEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

      // Count total signups to show position
      const { count } = await supabase
        .from("early_access_signups")
        .select("*", { count: "exact", head: true })

      sendEmail({
        to: adminEmail,
        subject: `New Early Access Signup - ${email}`,
        heading: "New Early Access Signup",
        preheader: `${email} has signed up for early access on Chem Connect.`,
        sections: [
          {
            title: "Signup Details",
            content: `
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Product interest:</strong> ${productSlug || "All products"}</p>
              <p><strong>Signup position:</strong> #${count ?? "?"}</p>
            `,
          },
        ],
        ctaButton: {
          text: "View All Signups",
          url: `${appUrl}/admin/rewards`,
        },
        footerNote: "You're receiving this because a new customer signed up for early access on Chem Connect.",
      }).catch(() => {})
    }
  }

  return NextResponse.json(data, { status: 201 })
}
