import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getStripeServer } from "@/lib/stripe"
import {
  sendPaymentSuccessEmail,
  sendOrderConfirmationEmail,
} from "@/lib/email/notifications"
import { sendReceiptEmail } from "@/lib/email/receipt-email"

// POST /api/orders/[id]/confirm - confirm Stripe payment after client-side success
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      )
    }

    const body = await request.json()
    const { payment_intent_id } = body

    if (!payment_intent_id) {
      return NextResponse.json(
        { error: "payment_intent_id is required" },
        { status: 400 },
      )
    }

    // Verify the payment intent status with Stripe
    const paymentIntent = await getStripeServer().paymentIntents.retrieve(payment_intent_id)

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        {
          error: "Payment has not succeeded",
          status: paymentIntent.status,
        },
        { status: 400 },
      )
    }

    // Verify the order belongs to this user and matches the payment intent
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, user_id, stripe_payment_intent_id")
      .eq("id", id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
      )
    }

    if (order.user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      )
    }

    if (order.stripe_payment_intent_id !== payment_intent_id) {
      return NextResponse.json(
        { error: "Payment intent does not match this order" },
        { status: 400 },
      )
    }

    // Update order payment status
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Get Stripe receipt URL from the charge
    let stripeReceiptUrl: string | undefined
    try {
      const stripe = getStripeServer()
      // Expand latest_charge to get receipt_url
      const pi = await stripe.paymentIntents.retrieve(payment_intent_id, {
        expand: ["latest_charge"],
      })
      const charge = pi.latest_charge
      if (charge && typeof charge === "object" && "receipt_url" in charge) {
        stripeReceiptUrl = (charge as { receipt_url: string | null }).receipt_url || undefined
      }
    } catch {
      // Non-blocking - receipt URL is optional
    }

    // Send payment success + order confirmation + receipt emails (non-blocking)
    const { data: profile } = await supabase
      .from("profiles")
      .select("contact_name, email, company_name")
      .eq("id", user.id)
      .single()

    if (profile?.email) {
      sendPaymentSuccessEmail(profile.email, {
        customerName: profile.contact_name || "Customer",
        orderNumber: updatedOrder.order_number,
        amount: updatedOrder.total,
      })

      // Fetch order items with product shipping fees
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, product_name, quantity, unit, packaging_size, unit_price, total_price")
        .eq("order_id", id)

      // Get shipping fees from products
      const productIds = (orderItems ?? []).map((i) => i.product_id)
      const { data: shippingProducts } = await supabase
        .from("products")
        .select("id, shipping_fee")
        .in("id", productIds)
      const shippingMap = new Map(
        (shippingProducts ?? []).map((p) => [p.id, p.shipping_fee ?? 0]),
      )

      if (orderItems) {
        sendOrderConfirmationEmail(profile.email, {
          customerName: profile.contact_name || "Customer",
          orderNumber: updatedOrder.order_number,
          items: orderItems.map((item) => ({
            name: item.product_name,
            qty: item.quantity,
            unitPrice: item.unit_price,
            total: item.total_price,
            shippingFee: shippingMap.get(item.product_id) ?? 0,
          })),
          subtotal: updatedOrder.subtotal,
          shipping: updatedOrder.shipping,
          gst: updatedOrder.gst,
          processingFee: updatedOrder.processing_fee,
          total: updatedOrder.total,
          paymentMethod: "Card Payment (Stripe)",
        })

        // Send branded receipt with Stripe receipt link
        sendReceiptEmail(profile.email, {
          customerName: profile.contact_name || "Customer",
          companyName: profile.company_name || undefined,
          customerEmail: profile.email,
          orderNumber: updatedOrder.order_number,
          date: new Date(updatedOrder.created_at).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          items: orderItems.map((item) => ({
            name: item.product_name,
            qty: item.quantity,
            unit: item.unit,
            packagingSize: item.packaging_size,
            unitPrice: item.unit_price,
            total: item.total_price,
            shippingFee: shippingMap.get(item.product_id) ?? 0,
          })),
          subtotal: updatedOrder.subtotal,
          shipping: updatedOrder.shipping,
          gst: updatedOrder.gst,
          processingFee: updatedOrder.processing_fee,
          total: updatedOrder.total,
          paymentMethod: "Card Payment (Stripe)",
          stripeReceiptUrl,
        })
      }
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    })
  } catch (err) {
    console.error("POST /api/orders/[id]/confirm error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
