import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { getStripeServer } from "@/lib/stripe"
import {
  sendPaymentSuccessEmail,
  sendOrderConfirmationEmail,
} from "@/lib/email/notifications"
import { sendReceiptEmail } from "@/lib/email/receipt-email"
import { sendEmail, getAdminEmail } from "@/lib/email/send"
import { autoAddStampsForOrder } from "@/lib/utils/auto-stamp"

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
        const isFreeShipping = updatedOrder.shipping === 0
        sendOrderConfirmationEmail(profile.email, {
          customerName: profile.contact_name || "Customer",
          orderNumber: updatedOrder.order_number,
          items: orderItems.map((item) => ({
            name: item.product_name,
            qty: item.quantity,
            unitPrice: item.unit_price,
            total: item.total_price,
            shippingFee: isFreeShipping ? 0 : (shippingMap.get(item.product_id) ?? 0),
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
            shippingFee: isFreeShipping ? 0 : (shippingMap.get(item.product_id) ?? 0),
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

    // Auto-add stamps for IBC items (Stripe payment confirmed)
    try {
      const stampResult = await autoAddStampsForOrder(id, user.id)
      if (stampResult.stampsAdded > 0) {
        console.log(`Auto-stamp: +${stampResult.stampsAdded} stamps for order ${id}`)
      }
    } catch (err) {
      console.error("Auto-stamp failed for confirmed order:", id, err)
    }

    // --- Bonus Credit Promotion Check (Stripe confirmed) ---
    try {
      const { data: activePromos } = await supabase
        .from("promotions")
        .select("*")
        .eq("is_active", true)
        .eq("discount_type", "bonus_credit")

      const { data: confirmOrderItems } = await supabase
        .from("order_items")
        .select("product_id, product_name, quantity, unit_price")
        .eq("order_id", id)

      if (activePromos && activePromos.length > 0 && confirmOrderItems) {
        const now = new Date()
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        const customerName = profile?.contact_name || "Customer"
        const customerEmail = profile?.email || ""

        for (const promo of activePromos) {
          if (promo.start_date && new Date(promo.start_date) > now) continue
          if (promo.end_date) { const end = new Date(promo.end_date); end.setHours(23,59,59,999); if (end < now) continue }
          // Check min order against the final total (after all discounts) to match what was shown at checkout
          if (promo.min_order_value > 0 && updatedOrder.total < promo.min_order_value) continue

          const eligibleIds: string[] = promo.eligible_product_ids ?? []
          const hasFilter = eligibleIds.length > 0
          const eligible = hasFilter
            ? confirmOrderItems.filter((i) => eligibleIds.includes(i.product_id))
            : confirmOrderItems

          if (hasFilter && eligible.length === 0) continue

          const eligibleTotal = eligible.reduce((s, i) => s + i.unit_price * i.quantity, 0)
          const creditAmount = Math.round(eligibleTotal * (promo.discount_value / 100) * 100) / 100

          if (creditAmount > 0 && customerEmail) {
            sendEmail({
              to: customerEmail,
              subject: `You've Qualified for Store Credit! - Chem Connect`,
              heading: promo.headline || `${promo.name} - Store Credit Earned!`,
              preheader: `Your order qualifies for ${promo.discount_value}% store credit ($${creditAmount.toFixed(2)}).`,
              sections: [
                { title: "Congratulations!", content: `<p>Hi ${customerName},</p><p>Your order <strong>#${updatedOrder.order_number}</strong> qualifies for our <strong>${promo.name}</strong> promotion!</p><p>You've earned <strong>${promo.discount_value}% store credit</strong> worth <strong>$${creditAmount.toFixed(2)}</strong>.</p>` },
                { title: "What Happens Next", content: `<p>Our team at Chem Connect will be reaching out to you shortly to apply your store credit. If for any reason our team doesn't reach out within a few business days, please contact us directly.</p><p>You can reach us through your <a href="${appUrl}/dashboard/rewards" style="color: #52c77d;">rewards dashboard</a> or by replying to this email.</p>` },
              ],
              ctaButton: { text: "View Your Orders", url: `${appUrl}/dashboard/orders` },
              footerNote: `You're receiving this because your order qualified for the ${promo.name} promotion on Chem Connect.`,
            }).catch(() => {})

            const adminEmail = await getAdminEmail()
            if (adminEmail) {
              sendEmail({
                to: adminEmail,
                subject: `Bonus Credit Earned - Order #${updatedOrder.order_number}`,
                heading: "Customer Earned Bonus Store Credit",
                sections: [{ title: "Details", content: `<p><strong>Customer:</strong> ${customerName} (${customerEmail})</p><p><strong>Company:</strong> ${profile?.company_name || "N/A"}</p><p><strong>Order:</strong> #${updatedOrder.order_number} ($${updatedOrder.total})</p><p><strong>Promotion:</strong> ${promo.name} - ${promo.discount_value}% credit = <strong>$${creditAmount.toFixed(2)}</strong></p><p>Please arrange the store credit for this customer.</p>` }],
                ctaButton: { text: "View Orders", url: `${appUrl}/admin/orders` },
                footerNote: "Auto-generated when an order qualifies for a bonus credit promotion.",
              }).catch(() => {})
            }
          }
        }
      }
    } catch (err) {
      console.error("Bonus credit check failed:", err)
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
