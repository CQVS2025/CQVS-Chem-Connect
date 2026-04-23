import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { getStripeServer } from "@/lib/stripe"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendPaymentFailedEmail } from "@/lib/email/notifications"
import { finalizeStripeOrder } from "@/lib/orders/finalize"

// Stripe webhook - server-to-server, no user session.
//
// Handles:
//   - payment_intent.succeeded  -> finalize order from checkout_session
//   - payment_intent.payment_failed -> notify customer (no order exists
//     yet; nothing to update since we moved order creation into finalize)
//
// All other event types fall through to a logged no-op.
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

    let event: Stripe.Event
    try {
      event = getStripeServer().webhooks.constructEvent(
        body,
        signature,
        webhookSecret,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.error("Webhook signature verification failed:", message)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        // Look up the session ourselves so we can pull out user_id -
        // finalizeStripeOrder needs it and the webhook has no user session.
        const { data: session } = await supabase
          .from("checkout_sessions")
          .select("id, user_id, stripe_payment_intent_id, amount_total, payload")
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .maybeSingle()

        if (!session) {
          // Either (a) the client-side finalize already ran and deleted
          // the session (expected fast path), or (b) this PI wasn't ours
          // (e.g. from a different Stripe product on the same account).
          // Either way, nothing to do.
          console.log(
            `[stripe webhook] No checkout_session for PI ${paymentIntent.id} - assuming already finalized`,
          )
          break
        }

        const result = await finalizeStripeOrder({
          supabase,
          userId: session.user_id,
          paymentIntentId: paymentIntent.id,
          paymentIntent,
          sessionRow: session,
        })

        if (!result.ok) {
          console.error(
            `[stripe webhook] finalize failed for PI ${paymentIntent.id}:`,
            result.error,
          )
          // Return 500 so Stripe retries - safer than dropping the event.
          return NextResponse.json(
            { error: result.error },
            { status: 500 },
          )
        }

        console.log(
          `[stripe webhook] Finalized order ${result.orderNumber} for PI ${paymentIntent.id} (alreadyFinalized=${result.alreadyFinalized})`,
        )
        break
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        // With the new flow, there's no orders row to update - the order
        // is never inserted until payment succeeds. We still email the
        // customer if we can identify them from the checkout_session.
        const { data: session } = await supabase
          .from("checkout_sessions")
          .select("user_id, amount_total")
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .maybeSingle()

        if (!session) {
          console.log(
            `[stripe webhook] payment_failed for PI ${paymentIntent.id} - no matching checkout_session`,
          )
          break
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("contact_name, email")
          .eq("id", session.user_id)
          .single()

        if (profile?.email) {
          sendPaymentFailedEmail(profile.email, {
            customerName: profile.contact_name || "Customer",
            orderNumber: "(pending)",
            amount: session.amount_total,
          })
        }
        break
      }

      default:
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
