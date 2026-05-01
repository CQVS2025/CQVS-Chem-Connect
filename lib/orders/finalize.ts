import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import {
  calculateOrder,
  type CalculateOrderInput,
  type CalculatedOrder,
  type OrderItemSnapshot,
} from "@/lib/orders/calculate"
import { getStripeServer } from "@/lib/stripe"
import {
  sendPaymentSuccessEmail,
  sendOrderConfirmationEmail,
  notifyAdminNewOrder,
} from "@/lib/email/notifications"
import { sendReceiptEmail } from "@/lib/email/receipt-email"
import { sendEmail, getAdminEmail } from "@/lib/email/send"
import { autoAddStampsForOrder } from "@/lib/utils/auto-stamp"
import {
  isMacShipConfigured,
  createConsignment,
  type MachshipItem,
} from "@/lib/macship/client"
import { getOrderPickupDate } from "@/lib/macship/lead-time"
import {
  buildConsolidatedCart,
  buildCapacityMap,
  buildParcelCart,
} from "@/lib/macship/pallet-consolidation"

// Finalize a card order after Stripe confirms the PaymentIntent.
//
// This function is the atomic "payment succeeded -> real order exists"
// transition. It's intentionally idempotent because two callers race it:
//   - POST /api/orders/finalize  (fires from the browser after confirmPayment)
//   - payment_intent.succeeded webhook  (fires server-to-server from Stripe)
//
// Whichever wins inserts the order; the loser sees stripe_payment_intent_id
// already present in `orders` and returns the existing row.
//
// Requires a service-role Supabase client - we insert + update across
// multiple tables (orders, order_items, customer_rewards, referrals, cart)
// that RLS would otherwise gate per-user. The webhook has no user session
// anyway, so this is the simpler call-site contract.

function isDgClassification(
  classification: string | null | undefined,
): boolean {
  if (!classification) return false
  const c = classification.toLowerCase()
  return c !== "non-dg" && c !== "non dg" && c !== "none" && c !== ""
}

interface FinalizeArgs {
  supabase: SupabaseClient
  userId: string
  paymentIntentId: string
  // Optional: pass the PI if already retrieved, to save a Stripe roundtrip.
  paymentIntent?: Stripe.PaymentIntent
  // Optional: pass the checkout session row if already fetched.
  sessionRow?: CheckoutSessionRow
}

export interface CheckoutSessionRow {
  id: string
  user_id: string
  stripe_payment_intent_id: string
  amount_total: number
  payload: FinalizePayload
}

// Exactly what /api/orders wrote into payload when the session was created.
export type FinalizePayload = CalculateOrderInput & {
  po_number?: string | null
  invoice_email?: string | null
  forklift_available?: boolean | null
  delivery_address_street?: string | null
  delivery_address_city?: string | null
  delivery_address_state?: string | null
  delivery_address_postcode?: string | null
  delivery_notes?: string | null
  macship_carrier_id?: string | null
  macship_shipping_breakdown?: Record<string, unknown> | null
  macship_service_name?: string | null
  macship_eta_date?: string | null
  macship_eta_business_days?: number | null
  macship_quote_shape?: "parcel" | "pallet" | null
  macship_is_dg?: boolean | null
}

export type FinalizeResult =
  | {
      ok: true
      orderId: string
      orderNumber: string
      alreadyFinalized: boolean
    }
  | {
      ok: false
      error: string
      status: number
    }

export async function finalizeStripeOrder({
  supabase,
  userId,
  paymentIntentId,
  paymentIntent: providedPi,
  sessionRow: providedSession,
}: FinalizeArgs): Promise<FinalizeResult> {
  // --- Idempotency short-circuit -------------------------------------------
  // If a previous finalize already inserted the order, return it.
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  if (existingOrder) {
    return {
      ok: true,
      orderId: existingOrder.id,
      orderNumber: existingOrder.order_number,
      alreadyFinalized: true,
    }
  }

  // --- Verify payment with Stripe (source of truth) ------------------------
  const stripe = getStripeServer()
  const pi =
    providedPi ??
    (await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    }))

  if (pi.status !== "succeeded") {
    return {
      ok: false,
      error: `Payment has not succeeded (status: ${pi.status})`,
      status: 400,
    }
  }

  // --- Load the checkout session that held the order payload ---------------
  let sessionRow = providedSession
  if (!sessionRow) {
    const { data, error } = await supabase
      .from("checkout_sessions")
      .select("id, user_id, stripe_payment_intent_id, amount_total, payload")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle()
    if (error || !data) {
      return {
        ok: false,
        error: "Checkout session not found for this payment",
        status: 404,
      }
    }
    sessionRow = data as CheckoutSessionRow
  }

  if (sessionRow.user_id !== userId) {
    return { ok: false, error: "Forbidden", status: 403 }
  }

  // --- Re-run the calculation against current DB state ---------------------
  // If bundles/promos changed between session-create and finalize, we
  // trust the current state. Amount mismatch guards against larger-than-
  // -expected charges; smaller is fine (we already charged less).
  const calc = await calculateOrder(supabase, userId, sessionRow.payload)
  if (!calc.ok) {
    return { ok: false, error: calc.error, status: calc.status }
  }

  // Stripe's amount is cents; the PaymentIntent was created with
  // Math.round(sessionRow.amount_total * 100). Allow up to 1 cent drift
  // for floating point, but flag anything bigger.
  const expectedAmount = Math.round(sessionRow.amount_total * 100)
  if (pi.amount !== expectedAmount) {
    console.warn(
      `[finalize] PaymentIntent amount (${pi.amount}c) differs from session amount_total (${expectedAmount}c) for pi=${paymentIntentId}. Using session amount for order total.`,
    )
  }

  // --- Insert the order ----------------------------------------------------
  const payload = sessionRow.payload
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      status: "received",
      payment_method: "stripe",
      payment_status: "paid",
      po_number: payload.po_number || null,
      stripe_payment_intent_id: paymentIntentId,
      subtotal: calc.calculated.subtotal,
      shipping: calc.calculated.shipping,
      gst: calc.calculated.gst,
      processing_fee: calc.calculated.processing_fee,
      container_total: calc.calculated.container_total,
      total: calc.calculated.total,
      bundle_discount: calc.calculated.bundle_discount || 0,
      first_order_discount: calc.calculated.first_order_discount || 0,
      first_order_type: calc.calculated.first_order_choice || null,
      promo_discount: calc.calculated.promo_discount || 0,
      promo_names: calc.calculated.applied_promo_names,
      invoice_email: payload.invoice_email || null,
      forklift_available:
        typeof payload.forklift_available === "boolean"
          ? payload.forklift_available
          : null,
      warehouse_id: calc.selectedWarehouse?.id ?? null,
      delivery_address_street: payload.delivery_address_street || null,
      delivery_address_city: payload.delivery_address_city || null,
      delivery_address_state: payload.delivery_address_state || null,
      delivery_address_postcode: payload.delivery_address_postcode || null,
      delivery_notes: payload.delivery_notes || null,
      macship_shipping_breakdown: payload.macship_shipping_breakdown ?? null,
      macship_service_name: payload.macship_service_name ?? null,
      macship_eta_date: payload.macship_eta_date ?? null,
      macship_eta_business_days: payload.macship_eta_business_days ?? null,
    })
    .select()
    .single()

  if (orderError || !order) {
    // Unique-violation on stripe_payment_intent_id means another caller
    // (the webhook vs the client) just won the race. Treat as success.
    if (orderError && orderError.code === "23505") {
      const { data: winner } = await supabase
        .from("orders")
        .select("id, order_number")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .single()
      if (winner) {
        return {
          ok: true,
          orderId: winner.id,
          orderNumber: winner.order_number,
          alreadyFinalized: true,
        }
      }
    }
    return {
      ok: false,
      error: orderError?.message ?? "Failed to insert order",
      status: 500,
    }
  }

  // Order items snapshot.
  const { error: itemsError } = await supabase.from("order_items").insert(
    calc.orderItems.map((oi) => ({
      order_id: order.id,
      ...oi,
    })),
  )
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id)
    return { ok: false, error: itemsError.message, status: 500 }
  }

  // --- Mark first-order incentive as used ---------------------------------
  if (
    calc.calculated.first_order_choice === "free_freight" &&
    calc.calculated.first_order_free_freight
  ) {
    await supabase
      .from("customer_rewards")
      .update({
        first_order_incentive_used: true,
        first_order_incentive_type: "free_freight",
      })
      .eq("user_id", userId)
  } else if (
    calc.calculated.first_order_choice === "half_price_truck_wash" &&
    calc.calculated.first_order_discount > 0
  ) {
    await supabase
      .from("customer_rewards")
      .update({
        first_order_incentive_used: true,
        first_order_incentive_type: "half_price_truck_wash",
      })
      .eq("user_id", userId)
  }

  // --- MacShip consignment (non-blocking but awaited for UI freshness) ----
  const macshipData = await runMacshipConsignment({
    supabase,
    order,
    payload,
    orderItems: calc.orderItems,
    productMap: calc.productMap,
    selectedWarehouse: calc.selectedWarehouse,
  })

  if (
    macshipData.consignment_id ||
    macshipData.failed ||
    macshipData.pickup_date ||
    macshipData.carrier_id
  ) {
    await supabase
      .from("orders")
      .update({
        macship_consignment_id: macshipData.consignment_id || null,
        macship_carrier_id: macshipData.carrier_id || null,
        macship_tracking_url: macshipData.tracking_url || null,
        macship_pickup_date: macshipData.pickup_date || null,
        macship_quote_amount: macshipData.quote_amount || null,
        macship_governing_product_id:
          macshipData.governing_product_id || null,
        macship_consignment_failed: macshipData.failed || false,
        macship_lead_time_fallback: macshipData.used_fallback || false,
      })
      .eq("id", order.id)
  }

  // --- Clear cart ---------------------------------------------------------
  await supabase.from("cart_items").delete().eq("user_id", userId)

  // --- Delete the consumed checkout session -------------------------------
  await supabase.from("checkout_sessions").delete().eq("id", sessionRow.id)

  // --- Profile lookup for emails ------------------------------------------
  const { data: profile } = await supabase
    .from("profiles")
    .select("contact_name, email, company_name, phone")
    .eq("id", userId)
    .single()

  const customerName = profile?.contact_name || "Customer"
  const customerEmail = profile?.email || ""

  // --- Emails: admin + customer -------------------------------------------
  notifyAdminNewOrder({
    customerName,
    customerEmail,
    companyName: profile?.company_name ?? undefined,
    orderNumber: order.order_number,
    total: order.total,
    paymentMethod: "Card Payment",
    itemCount: calc.orderItems.length,
  })

  if (customerEmail) {
    sendPaymentSuccessEmail(customerEmail, {
      customerName,
      orderNumber: order.order_number,
      amount: order.total,
    })

    const { data: shippingProducts } = await supabase
      .from("products")
      .select("id, shipping_fee")
      .in(
        "id",
        calc.orderItems.map((i) => i.product_id),
      )
    const shippingMap = new Map(
      (shippingProducts ?? []).map(
        (p: { id: string; shipping_fee: number | null }) => [
          p.id,
          p.shipping_fee ?? 0,
        ],
      ),
    )
    const isFreeShipping = order.shipping === 0

    sendOrderConfirmationEmail(customerEmail, {
      customerName,
      orderNumber: order.order_number,
      items: calc.orderItems.map((item) => ({
        name: item.product_name,
        qty: item.quantity,
        unitPrice: item.unit_price,
        total: item.total_price,
        shippingFee: isFreeShipping
          ? 0
          : shippingMap.get(item.product_id) ?? 0,
      })),
      subtotal: order.subtotal,
      shipping: order.shipping,
      gst: order.gst,
      processingFee: order.processing_fee,
      total: order.total,
      paymentMethod: "Card Payment (Stripe)",
    })

    // Stripe's own receipt URL from the charge - only exists post-capture.
    let stripeReceiptUrl: string | undefined
    const charge = pi.latest_charge
    if (charge && typeof charge === "object" && "receipt_url" in charge) {
      stripeReceiptUrl =
        (charge as { receipt_url: string | null }).receipt_url || undefined
    }

    sendReceiptEmail(customerEmail, {
      customerName,
      companyName: profile?.company_name || undefined,
      customerEmail,
      orderNumber: order.order_number,
      date: new Date(order.created_at).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      items: calc.orderItems.map((item) => ({
        name: item.product_name,
        qty: item.quantity,
        unit: item.unit,
        packagingSize: item.packaging_size,
        unitPrice: item.unit_price,
        total: item.total_price,
        shippingFee: isFreeShipping
          ? 0
          : shippingMap.get(item.product_id) ?? 0,
      })),
      subtotal: order.subtotal,
      shipping: order.shipping,
      gst: order.gst,
      processingFee: order.processing_fee,
      total: order.total,
      paymentMethod: "Card Payment (Stripe)",
      stripeReceiptUrl,
    })
  }

  // --- Auto-stamp IBC items -----------------------------------------------
  try {
    const stampResult = await autoAddStampsForOrder(order.id, userId)
    if (stampResult.stampsAdded > 0) {
      console.log(
        `[finalize] Auto-stamp: +${stampResult.stampsAdded} stamps for order ${order.id}`,
      )
    }
  } catch (err) {
    console.error("[finalize] Auto-stamp failed:", order.id, err)
  }

  // --- Bonus credit emails -----------------------------------------------
  if (calc.calculated.qualified_bonus_credits.length > 0 && customerEmail) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    for (const bc of calc.calculated.qualified_bonus_credits) {
      sendEmail({
        to: customerEmail,
        subject: `You've Qualified for Store Credit! - Chem Connect`,
        heading: bc.headline || `${bc.promoName} - Store Credit Earned!`,
        preheader: `Your order qualifies for ${bc.creditPercent}% store credit (AUD ${bc.creditAmount.toFixed(2)}).`,
        sections: [
          {
            title: "Congratulations!",
            content: `<p>Hi ${customerName},</p><p>Your order <strong>#${order.order_number}</strong> qualifies for our <strong>${bc.promoName}</strong> promotion!</p><p>You've earned <strong>${bc.creditPercent}% store credit</strong> worth <strong>AUD ${bc.creditAmount.toFixed(2)}</strong> on eligible products in this order.</p>`,
          },
          {
            title: "What Happens Next",
            content: `<p>Our team at Chem Connect will be reaching out to you shortly to apply your store credit. Please wait patiently while we process your reward.</p><p>If for any reason our team doesn't reach out to you within a few business days, please don't hesitate to contact us directly.</p><p>You can reach us through your <a href="${appUrl}/dashboard/rewards" style="color: #52c77d; text-decoration: underline;">rewards dashboard</a> or by replying to this email.</p>`,
          },
        ],
        ctaButton: {
          text: "View Your Orders",
          url: `${appUrl}/dashboard/orders`,
        },
        footerNote: `You're receiving this because your order qualified for the ${bc.promoName} seasonal promotion on Chem Connect.`,
      }).catch(() => {})
    }

    const adminEmail = await getAdminEmail()
    if (adminEmail) {
      const creditSummary = calc.calculated.qualified_bonus_credits
        .map(
          (bc) =>
            `<li><strong>${bc.promoName}</strong>: ${bc.creditPercent}% credit on AUD ${bc.eligibleTotal.toFixed(2)} eligible products = <strong>AUD ${bc.creditAmount.toFixed(2)} credit</strong></li>`,
        )
        .join("")
      sendEmail({
        to: adminEmail,
        subject: `Bonus Credit Earned - Order #${order.order_number}`,
        heading: "Customer Earned Bonus Store Credit",
        preheader: `${customerName} qualified for bonus credit on order #${order.order_number}.`,
        sections: [
          {
            title: "Order & Credit Details",
            content: `<p><strong>Customer:</strong> ${customerName}</p><p><strong>Email:</strong> ${customerEmail}</p><p><strong>Company:</strong> ${profile?.company_name || "N/A"}</p><p><strong>Order:</strong> #${order.order_number}</p><p><strong>Order total:</strong> AUD ${order.total.toFixed(2)}</p><ul style="padding-left: 20px; margin: 10px 0;">${creditSummary}</ul><p>Please arrange the store credit for this customer. The customer has been notified and is expecting to hear from you.</p>`,
          },
        ],
        ctaButton: {
          text: "View Orders",
          url: `${appUrl}/admin/orders`,
        },
        footerNote:
          "Auto-generated when an order qualifies for a bonus credit promotion.",
      }).catch(() => {})
    }
  }

  // --- Referral auto-conversion ------------------------------------------
  // Uses service role context (we're already on a service client).
  if (customerEmail) {
    const { data: pendingReferrals } = await supabase
      .from("referrals")
      .select(
        "id, referrer_id, referrer_name, referred_site_name, referred_contact_name, status",
      )
      .eq("referred_email", customerEmail)
      .in("status", ["pending", "contacted"])

    if (pendingReferrals && pendingReferrals.length > 0) {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      for (const ref of pendingReferrals as Array<{
        id: string
        referrer_id: string | null
        referrer_name: string | null
        referred_site_name: string
        referred_contact_name: string
      }>) {
        await supabase
          .from("referrals")
          .update({ status: "converted", reward_given: false })
          .eq("id", ref.id)

        if (ref.referrer_id) {
          const { data: referrerProfile } = await supabase
            .from("profiles")
            .select("email, contact_name")
            .eq("id", ref.referrer_id)
            .maybeSingle()

          const { count: convertedCount } = await supabase
            .from("referrals")
            .select("*", { count: "exact", head: true })
            .eq("referrer_id", ref.referrer_id)
            .eq("status", "converted")

          const totalConverted = convertedCount ?? 0
          const referrerEmail = referrerProfile?.email
          const referrerName = referrerProfile?.contact_name || ref.referrer_name

          if (referrerEmail) {
            let milestoneTitle = ""
            let milestoneReward = ""
            if (totalConverted === 1) {
              milestoneTitle = "Your First Referral Converted!"
              milestoneReward =
                "You've earned a <strong>free 200L drum of Truck Wash Standard or Premium</strong>."
            } else if (totalConverted === 3) {
              milestoneTitle =
                "3 Referrals Converted - Free Freight Unlocked!"
              milestoneReward =
                "All 3 of your referred customers have placed orders. You've earned <strong>free freight for a full quarter</strong>."
            } else if (totalConverted === 5) {
              milestoneTitle = "5 Referrals - Ambassador Status Achieved!"
              milestoneReward =
                "All 5 of your referred customers have placed orders. You now qualify for a <strong>permanent 5% discount</strong> on all future orders."
            }

            const contactSection = {
              title: "What Happens Next",
              content: `<p>Our team at Chem Connect will be reaching out to you shortly to arrange your reward. If for any reason you don't hear from us within a few business days, please don't hesitate to get in touch with us directly.</p><p>You can contact us anytime through your <a href="${appUrl}/dashboard/rewards" style="color: #52c77d; text-decoration: underline;">rewards dashboard</a> or by replying to this email.</p>`,
            }

            sendEmail({
              to: referrerEmail,
              subject: `${ref.referred_site_name} just placed an order! - Chem Connect`,
              heading: milestoneTitle || "Your Referral Just Placed an Order!",
              preheader: `${ref.referred_contact_name} from ${ref.referred_site_name} has placed their first order on Chem Connect.`,
              sections: [
                {
                  title: "Referral Converted",
                  content: `<p>Hi ${referrerName},</p><p>Great news! <strong>${ref.referred_contact_name}</strong> from <strong>${ref.referred_site_name}</strong> just placed their first order on Chem Connect.</p><p>You now have <strong>${totalConverted} converted referral${totalConverted > 1 ? "s" : ""}</strong>.</p>`,
                },
                ...(milestoneReward
                  ? [{ title: "Your Reward", content: `<p>${milestoneReward}</p>` }]
                  : [
                      {
                        content: `<p>Keep referring! ${totalConverted < 3 ? `${3 - totalConverted} more to unlock free freight for a quarter.` : totalConverted < 5 ? `${5 - totalConverted} more to unlock Ambassador status with a permanent 5% discount.` : "You're an Ambassador - enjoy your 5% discount!"}</p>`,
                      },
                    ]),
                contactSection,
              ],
              ctaButton: {
                text: "View Your Rewards",
                url: `${appUrl}/dashboard/rewards`,
              },
              footerNote:
                "You're receiving this because someone you referred just placed their first order on Chem Connect.",
            }).catch(() => {})

            const adminEmail = await getAdminEmail()
            if (adminEmail) {
              sendEmail({
                to: adminEmail,
                subject: `Referral Auto-Converted - ${ref.referred_site_name}`,
                heading: "Referral Auto-Converted",
                preheader: `${ref.referred_contact_name} placed an order. Referral by ${referrerName} has been converted.`,
                sections: [
                  {
                    title: "Details",
                    content: `<p><strong>Referred by:</strong> ${referrerName} (${referrerEmail})</p><p><strong>Referred site:</strong> ${ref.referred_site_name}</p><p><strong>Contact:</strong> ${ref.referred_contact_name} (${customerEmail})</p><p><strong>Referrer's total conversions:</strong> ${totalConverted}</p>${milestoneTitle ? `<p style="color: #52c77d;"><strong>Milestone hit:</strong> ${milestoneTitle}</p>` : ""}`,
                  },
                ],
                ctaButton: {
                  text: "View Referrals",
                  url: `${appUrl}/admin/rewards`,
                },
                footerNote:
                  "Auto-converted because the referred customer placed their first order.",
              }).catch(() => {})
            }
          }
        }
      }
    }
  }

  // --- Xero PO (fire-and-forget) -----------------------------------------
  import("@/lib/xero/sync").then(({ createXeroPurchaseOrderForOrder }) => {
    createXeroPurchaseOrderForOrder(order.id)
      .then((result) => {
        if (result) {
          console.log(
            `[Xero] PO created for ${order.order_number}: ${result.poNumber}`,
          )
        } else {
          console.warn(
            `[Xero] PO NOT created for ${order.order_number} - check /admin/xero or xero_sync_log table`,
          )
        }
      })
      .catch((err) => {
        console.error("[Xero] PO creation failed (non-blocking):", err)
      })
  })

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.order_number,
    alreadyFinalized: false,
  }
}

// --- MacShip consignment helper --------------------------------------------
// Kept separate so finalize() stays readable. Mirrors the block that used
// to live inside POST /api/orders.

interface MacshipData {
  consignment_id?: string
  carrier_id?: string
  tracking_url?: string
  pickup_date?: string
  quote_amount?: number
  governing_product_id?: string
  used_fallback?: boolean
  failed?: boolean
}

async function runMacshipConsignment(args: {
  supabase: SupabaseClient
  order: { id: string; order_number: string }
  payload: FinalizePayload
  orderItems: OrderItemSnapshot[]
  productMap: Map<string, { id: string; classification?: string | null }>
  selectedWarehouse: {
    id: string
    address_state: string
    address_street: string
    address_city: string
    address_postcode: string
    name: string
    contact_phone: string | null
    contact_email: string | null
  } | null
}): Promise<MacshipData> {
  const { supabase, order, payload, orderItems, productMap, selectedWarehouse } =
    args
  let macshipData: MacshipData = {}

  try {
    if (selectedWarehouse) {
      const pickupResult = await getOrderPickupDate(
        orderItems.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
        selectedWarehouse.id,
        selectedWarehouse.address_state,
        supabase,
      )

      // Record the quote-derived fields even when Machship isn't configured
      // (for local dev / staging without a Machship token).
      macshipData = {
        carrier_id: payload.macship_carrier_id || undefined,
        quote_amount: payload.macship_quote_amount ?? undefined,
        pickup_date: pickupResult.pickupDate,
        governing_product_id: pickupResult.governingProductId || undefined,
        used_fallback: pickupResult.usedFallback,
        failed: false,
      }
    }

    if (isMacShipConfigured() && selectedWarehouse) {
      const pickupResult = await getOrderPickupDate(
        orderItems.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })),
        selectedWarehouse.id,
        selectedWarehouse.address_state,
        supabase,
      )

      // Admin-configured pallet capacities take precedence over the
      // hardcoded fallback table inside buildConsolidatedCart.
      const orderPackagingSizeIds = [
        ...new Set(
          orderItems
            .map((oi) => oi.packaging_size_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ]
      const { data: orderPackagingSizesData } =
        orderPackagingSizeIds.length > 0
          ? await supabase
              .from("packaging_sizes")
              .select("id, name, units_per_pallet, unit_weight_kg")
              .in("id", orderPackagingSizeIds)
          : {
              data: [] as Array<{
                id: string
                name: string
                units_per_pallet: number | null
                unit_weight_kg: number | null
              }>,
            }
      const orderCapacityMap = buildCapacityMap(orderPackagingSizesData ?? [])

      const consolidationInput = orderItems.map((oi) => {
        const product = productMap.get(oi.product_id)
        return {
          product_name: product
            ? (product as { id: string; name?: string }).name ??
              oi.product_name
            : oi.product_name,
          packaging_size_name: oi.packaging_size,
          packaging_size_id: oi.packaging_size_id,
          quantity: oi.quantity,
        }
      })

      // Match the item shape that won the customer's quote. The quote
      // endpoint tries parcel-first; if it picked a parcel-only carrier
      // (e.g. Aramex Parcel), creating the consignment with pallet items
      // makes Machship return "No prices were found" because that carrier
      // can't price pallets.
      const quoteShape: "parcel" | "pallet" =
        payload.macship_quote_shape === "parcel" ? "parcel" : "pallet"
      const parcelItems =
        quoteShape === "parcel"
          ? buildParcelCart(consolidationInput, orderCapacityMap)
          : null
      const machshipItems: MachshipItem[] =
        parcelItems && parcelItems.length > 0
          ? parcelItems
          : buildConsolidatedCart(consolidationInput, orderCapacityMap)

      const carrierId = payload.macship_carrier_id
        ? parseInt(payload.macship_carrier_id, 10)
        : null
      const isDg =
        payload.macship_is_dg === true ||
        orderItems.some((oi) =>
          isDgClassification(productMap.get(oi.product_id)?.classification),
        )

      // Fetch customer profile for shipping address contact fields.
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("contact_name, email, company_name, phone")
        .eq("id", (order as unknown as { user_id?: string }).user_id ?? "")
        .maybeSingle()
      // user_id isn't on the narrowed type; fetch from orders row.
      const { data: orderRow } = await supabase
        .from("orders")
        .select("user_id")
        .eq("id", order.id)
        .single()
      const { data: customerProfile } = orderRow?.user_id
        ? await supabase
            .from("profiles")
            .select("contact_name, email, company_name, phone")
            .eq("id", orderRow.user_id)
            .maybeSingle()
        : { data: userProfile }

      if (isDg) {
        // The quote endpoint doesn't filter for DG-capable carriers and we
        // don't yet collect per-product DG metadata (UN number, packing
        // group, container type, etc.) required by Machship's DG endpoint.
        // Skip auto-consignment so admin books it manually in MacShip with
        // the correct DG paperwork.
        console.warn(
          `[finalize] DG order ${order.order_number} - skipping auto-consignment, book manually in MacShip`,
        )
        macshipData = { ...macshipData, failed: true }
      } else if (
        carrierId &&
        !Number.isNaN(carrierId) &&
        machshipItems.length > 0
      ) {
        const despatchDateLocal = `${pickupResult.pickupDate}T08:00:00`
        const consignmentResult = await createConsignment({
          despatchDateTimeLocal: despatchDateLocal,
          customerReference: order.order_number,
          carrierId,
          fromName: selectedWarehouse.name,
          fromContact: selectedWarehouse.name,
          fromPhone: selectedWarehouse.contact_phone || undefined,
          fromEmail: selectedWarehouse.contact_email || undefined,
          fromAddressLine1: selectedWarehouse.address_street,
          fromLocation: {
            suburb: selectedWarehouse.address_city,
            postcode: selectedWarehouse.address_postcode,
          },
          toName:
            customerProfile?.company_name ||
            customerProfile?.contact_name ||
            "Customer",
          toContact: customerProfile?.contact_name || undefined,
          toPhone: customerProfile?.phone || undefined,
          toEmail: customerProfile?.email || undefined,
          toAddressLine1: payload.delivery_address_street || "",
          toLocation: {
            suburb: payload.delivery_address_city || "",
            postcode: payload.delivery_address_postcode || "",
          },
          specialInstructions:
            payload.forklift_available === false
              ? "Tailgate truck required - no forklift on site"
              : undefined,
          // Machship question 7 = "Hydraulic Tailgate required".
          questionIds: payload.forklift_available === false ? [7] : [],
          dgsDeclaration: false,
          items: machshipItems,
        })

        const trackingUrl = consignmentResult.trackingPageAccessToken
          ? `https://mship.io/v2/${consignmentResult.trackingPageAccessToken}`
          : ""

        macshipData = {
          consignment_id: String(consignmentResult.id),
          carrier_id: String(consignmentResult.carrier?.id ?? carrierId),
          tracking_url: trackingUrl,
          pickup_date: pickupResult.pickupDate,
          quote_amount: payload.macship_quote_amount ?? undefined,
          governing_product_id: pickupResult.governingProductId || undefined,
          used_fallback: pickupResult.usedFallback,
          failed: false,
        }
      }
    }
  } catch (err) {
    // Preserve any fields already populated (e.g. carrier_id / quote_amount
    // from the first block, pickup_date from the lead-time calculation)
    // so the admin page can still show what was quoted even though the
    // consignment couldn't be booked. Previously we replaced the whole
    // object with { failed: true } which blanked out those fields.
    const detail =
      err instanceof Error ? `${err.message}${err.stack ? `\n${err.stack}` : ""}` : String(err)
    console.error(
      "[finalize] MacShip consignment failed (non-blocking) for order",
      order.order_number,
      "-",
      detail,
    )
    macshipData = { ...macshipData, failed: true }
  }

  return macshipData
}
