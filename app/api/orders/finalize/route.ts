import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { finalizeStripeOrder } from "@/lib/orders/finalize"

// POST /api/orders/finalize
//
// Called from the checkout page after stripe.confirmPayment() succeeds.
// Inserts the real order from the stored checkout_session and fires all
// downstream side effects (MacShip, Xero, emails, cart clear).
//
// The payment_intent.succeeded webhook calls the same finalize helper,
// so whichever fires first wins; the loser short-circuits via the
// idempotency check on stripe_payment_intent_id.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const paymentIntentId: string | undefined = body.payment_intent_id
    const checkoutSessionId: string | undefined = body.checkout_session_id

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "payment_intent_id is required" },
        { status: 400 },
      )
    }

    // Authorize: the calling user must own the session tied to this PI.
    // Using the user's client (respects RLS) so a user can't finalize
    // someone else's payment even if they guess a PI id.
    const { data: session } = await supabase
      .from("checkout_sessions")
      .select("id, user_id, stripe_payment_intent_id, amount_total, payload")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle()

    // If the session is already gone, that means either (a) the webhook
    // already finalized this payment, or (b) the PI id doesn't belong to
    // this user. We fall through to finalizeStripeOrder which handles
    // the idempotent case by returning the existing order.
    if (session && session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (checkoutSessionId && session && session.id !== checkoutSessionId) {
      return NextResponse.json(
        { error: "checkout_session_id does not match payment_intent_id" },
        { status: 400 },
      )
    }

    // The actual insert + side effects need service role (cross-user
    // lookups in referrals/customer_rewards, write to tables RLS gates).
    const serviceClient = createServiceRoleClient()
    const result = await finalizeStripeOrder({
      supabase: serviceClient,
      userId: user.id,
      paymentIntentId,
      sessionRow: session ?? undefined,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Return the fresh order so the client can navigate to it.
    const { data: order } = await serviceClient
      .from("orders")
      .select("*, order_items (*)")
      .eq("id", result.orderId)
      .single()

    return NextResponse.json({
      success: true,
      alreadyFinalized: result.alreadyFinalized,
      order,
    })
  } catch (err) {
    console.error("POST /api/orders/finalize error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
