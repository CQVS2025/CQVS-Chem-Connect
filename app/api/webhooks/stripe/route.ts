import { NextRequest, NextResponse } from "next/server"
import { getStripeServer } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import { sendPaymentFailedEmail } from "@/lib/email/notifications"

// Use service role client since webhooks have no user session
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    )
  }

  return createClient(supabaseUrl, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 },
      )
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set")
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 },
      )
    }

    let event
    try {
      event = getStripeServer().webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.error("Webhook signature verification failed:", message)
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 },
      )
    }

    const supabase = createServiceRoleClient()

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object
        const { error } = await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id)

        if (error) {
          console.error(
            "Failed to update order for payment_intent.succeeded:",
            error.message,
          )
        }
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object
        const { data: failedOrder, error } = await supabase
          .from("orders")
          .update({
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .select("id, order_number, total, user_id")
          .single()

        if (error) {
          console.error(
            "Failed to update order for payment_intent.payment_failed:",
            error.message,
          )
        }

        // Send payment failure email to customer
        if (failedOrder) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("contact_name, email")
            .eq("id", failedOrder.user_id)
            .single()

          if (profile?.email) {
            sendPaymentFailedEmail(profile.email, {
              customerName: profile.contact_name || "Customer",
              orderNumber: failedOrder.order_number,
              amount: failedOrder.total,
            })
          }
        }
        break
      }

      default:
        // Unhandled event type - log but don't error
        console.log("Unhandled webhook event type:", event.type)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error("POST /api/webhooks/stripe error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
