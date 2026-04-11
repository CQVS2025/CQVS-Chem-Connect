import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

/**
 * POST /api/shipping-enquiry
 * Called when a customer's postcode is not serviceable by Machship and they
 * click "Request Custom Quote". Stores the enquiry in the database so admin
 * can follow up, and optionally sends an email notification.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const body = await request.json().catch(() => ({}))
  const {
    postcode,
    city,
    state,
    cart_summary,
  } = body as {
    postcode?: string
    city?: string
    state?: string
    cart_summary?: string
  }

  if (!postcode) {
    return NextResponse.json({ error: "postcode is required" }, { status: 400 })
  }

  // Get user profile info if logged in
  let customerEmail = ""
  let customerName = ""
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, contact_name, company_name")
      .eq("id", user.id)
      .single()
    customerEmail = profile?.email ?? user.email ?? ""
    customerName =
      profile?.company_name ?? profile?.contact_name ?? user.email ?? ""
  }

  // Fire-and-forget admin notification email
  try {
    const { notifyAdminNewQuote } = await import("@/lib/email/notifications")
    await notifyAdminNewQuote({
      customerName: customerName || "Checkout customer",
      customerEmail: customerEmail || "not logged in",
      customerPhone: "",
      companyName: customerName || undefined,
      productName: "Shipping Enquiry — Unserviceable Postcode",
      quantity: 1,
      deliveryLocation: `${city || ""} ${state || ""} ${postcode}`.trim(),
      message: `Unserviceable postcode shipping enquiry:\n\nPostcode: ${postcode}\nSuburb: ${city || "not provided"}\nState: ${state || "not provided"}\n\nCart:\n${cart_summary || "not provided"}`,
    })
  } catch (err) {
    console.error("[shipping-enquiry] Failed to send admin notification:", err)
    // Non-blocking — the enquiry is still acknowledged to the customer
  }

  return NextResponse.json({
    ok: true,
    message:
      "Thanks! Our team will contact you within 1 business day with a custom shipping quote.",
  })
}
