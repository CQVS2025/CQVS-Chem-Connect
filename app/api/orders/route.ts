import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { getStripeServer } from "@/lib/stripe"
import { notifyAdminNewOrder } from "@/lib/email/notifications"
import { sendEmail, getAdminEmail } from "@/lib/email/send"
import { isMacShipConfigured, createConsignment } from "@/lib/macship/client"
import { getOrderPickupDate } from "@/lib/macship/lead-time"
import {
  buildConsolidatedCart,
  buildCapacityMap,
} from "@/lib/macship/pallet-consolidation"
import {
  calculateOrder,
  type CalculateOrderInput,
} from "@/lib/orders/calculate"

function isDgClassification(
  classification: string | null | undefined,
): boolean {
  if (!classification) return false
  const c = classification.toLowerCase()
  return c !== "non-dg" && c !== "non dg" && c !== "none" && c !== ""
}

// GET /api/orders - list orders (user sees own, admin sees all)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = request.nextUrl
    const statusFilter = searchParams.get("status")

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isAdmin = profile?.role === "admin"

    const orderItemsSelect = `
      id,
      product_id,
      product_name,
      product_image_url,
      quantity,
      unit,
      packaging_size,
      unit_price,
      total_price,
      shipping_fee
    `

    let query = supabase
      .from("orders")
      .select(`*, order_items (${orderItemsSelect})`)

    if (!isAdmin) {
      query = query.eq("user_id", user.id)
    }

    if (statusFilter) {
      query = query.eq("status", statusFilter)
    }

    query = query.order("created_at", { ascending: false })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let profileMap = new Map<
      string,
      {
        email: string
        company_name: string | null
        contact_name: string | null
        phone: string | null
      }
    >()

    if (isAdmin && data && data.length > 0) {
      const userIds = [...new Set(data.map((o) => o.user_id))]
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, company_name, contact_name, phone")
        .in("id", userIds)

      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, {
            email: p.email,
            company_name: p.company_name,
            contact_name: p.contact_name,
            phone: p.phone,
          })
        }
      }
    }

    const orders = (data ?? []).map((order) => {
      const { order_items, ...rest } = order
      return {
        ...rest,
        items: order_items ?? [],
        profile: profileMap.get(order.user_id) ?? undefined,
      }
    })

    return NextResponse.json(orders)
  } catch (err) {
    console.error("GET /api/orders error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

// POST /api/orders - create a new order
//
// PO path: inserts the order immediately with status=pending_approval and
// fires PO-specific side effects (admin email, under-review email to
// customer, MacShip consignment, referral conversion, bonus credit emails).
//
// Stripe path: does NOT insert into `orders`. Instead it creates a
// PaymentIntent and saves the full request body to `checkout_sessions`.
// The actual order is only inserted after Stripe confirms the payment,
// by POST /api/orders/finalize (client-driven) or the stripe webhook
// (server-to-server safety net). This prevents orphan orders + side
// effects for declined cards.
export async function POST(request: NextRequest) {
  try {
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
    const calcInput: CalculateOrderInput = {
      payment_method: body.payment_method,
      items: body.items,
      delivery_address_state: body.delivery_address_state,
      first_order_choice: body.first_order_choice,
      first_order_truck_wash: body.first_order_truck_wash,
      macship_quote_amount: body.macship_quote_amount,
    }

    const calc = await calculateOrder(supabase, user.id, calcInput)
    if (!calc.ok) {
      return NextResponse.json(
        { error: calc.error, ...(calc.moq !== undefined && { moq: calc.moq }) },
        { status: calc.status },
      )
    }

    // ---------- Stripe path: create session + PaymentIntent only ---------
    if (body.payment_method === "stripe") {
      const paymentIntent = await getStripeServer().paymentIntents.create({
        amount: Math.round(calc.calculated.total * 100),
        currency: "aud",
        metadata: {
          user_id: user.id,
        },
      })

      // Persist the payload so finalize can replay it. Uses service role
      // because we want the row visible to the webhook regardless of RLS.
      const serviceClient = createServiceRoleClient()
      const { data: session, error: sessionError } = await serviceClient
        .from("checkout_sessions")
        .insert({
          user_id: user.id,
          stripe_payment_intent_id: paymentIntent.id,
          payload: body,
          amount_total: calc.calculated.total,
        })
        .select()
        .single()

      if (sessionError || !session) {
        return NextResponse.json(
          { error: sessionError?.message ?? "Failed to create checkout session" },
          { status: 500 },
        )
      }

      return NextResponse.json(
        {
          checkout_session_id: session.id,
          payment_intent_id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          // Echo back the calculated total so the client can show the
          // authoritative figure (it won't differ from its own calc unless
          // bundles/promos drifted mid-session).
          amount_total: calc.calculated.total,
        },
        { status: 201 },
      )
    }

    // ---------- PO path: insert order + run side effects immediately ------
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "pending_approval",
        payment_method: "purchase_order",
        payment_status: "pending",
        po_number: body.po_number || null,
        stripe_payment_intent_id: null,
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
        invoice_email: body.invoice_email || null,
        forklift_available:
          typeof body.forklift_available === "boolean"
            ? body.forklift_available
            : null,
        warehouse_id: calc.selectedWarehouse?.id ?? null,
        delivery_address_street: body.delivery_address_street || null,
        delivery_address_city: body.delivery_address_city || null,
        delivery_address_state: body.delivery_address_state || null,
        delivery_address_postcode: body.delivery_address_postcode || null,
        delivery_notes: body.delivery_notes || null,
        macship_shipping_breakdown: body.macship_shipping_breakdown ?? null,
        macship_service_name: body.macship_service_name ?? null,
        macship_eta_date: body.macship_eta_date ?? null,
        macship_eta_business_days: body.macship_eta_business_days ?? null,
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      calc.orderItems.map((oi) => ({
        order_id: order.id,
        ...oi,
      })),
    )

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Mark first-order incentive as used up-front for PO flow. (For card
    // orders this happens inside finalize after the payment succeeds.)
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
        .eq("user_id", user.id)
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
        .eq("user_id", user.id)
    }

    // Profile lookup (needed for MacShip contact fields + emails).
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("contact_name, email, company_name, phone")
      .eq("id", user.id)
      .single()

    // MacShip consignment (non-blocking).
    let macshipData: {
      consignment_id?: string
      carrier_id?: string
      tracking_url?: string
      pickup_date?: string
      manifest_id?: null
      quote_amount?: number
      governing_product_id?: string
      used_fallback?: boolean
      failed?: boolean
    } = {}

    try {
      if (calc.selectedWarehouse) {
        const pickupResult = await getOrderPickupDate(
          calc.orderItems.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          calc.selectedWarehouse.id,
          calc.selectedWarehouse.address_state,
          supabase,
        )

        macshipData = {
          carrier_id: body.macship_carrier_id || undefined,
          quote_amount: body.macship_quote_amount,
          pickup_date: pickupResult.pickupDate,
          governing_product_id: pickupResult.governingProductId || undefined,
          used_fallback: pickupResult.usedFallback,
          failed: false,
        }
      }

      if (isMacShipConfigured() && calc.selectedWarehouse) {
        const pickupResult = await getOrderPickupDate(
          calc.orderItems.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          calc.selectedWarehouse.id,
          calc.selectedWarehouse.address_state,
          supabase,
        )

        const orderPackagingSizeIds = [
          ...new Set(
            calc.orderItems
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

        const machshipItems = buildConsolidatedCart(
          calc.orderItems.map((oi) => {
            const product = calc.productMap.get(oi.product_id)
            return {
              product_name: product?.name ?? oi.product_name,
              packaging_size_name: oi.packaging_size,
              packaging_size_id: oi.packaging_size_id,
              quantity: oi.quantity,
            }
          }),
          orderCapacityMap,
        )

        const carrierId = body.macship_carrier_id
          ? parseInt(body.macship_carrier_id, 10)
          : null
        const isDg = calc.orderItems.some((oi) =>
          isDgClassification(
            calc.productMap.get(oi.product_id)?.classification,
          ),
        )

        if (carrierId && !Number.isNaN(carrierId) && machshipItems.length > 0) {
          const despatchDateLocal = `${pickupResult.pickupDate}T08:00:00`
          const consignmentResult = await createConsignment({
            despatchDateTimeLocal: despatchDateLocal,
            customerReference: order.order_number,
            carrierId,
            fromName: calc.selectedWarehouse.name,
            fromContact: calc.selectedWarehouse.name,
            fromPhone: calc.selectedWarehouse.contact_phone || undefined,
            fromEmail: calc.selectedWarehouse.contact_email || undefined,
            fromAddressLine1: calc.selectedWarehouse.address_street,
            fromLocation: {
              suburb: calc.selectedWarehouse.address_city,
              postcode: calc.selectedWarehouse.address_postcode,
            },
            toName:
              userProfile?.company_name ||
              userProfile?.contact_name ||
              "Customer",
            toContact: userProfile?.contact_name || undefined,
            toPhone: userProfile?.phone || undefined,
            toEmail: userProfile?.email || undefined,
            toAddressLine1: body.delivery_address_street || "",
            toLocation: {
              suburb: body.delivery_address_city || "",
              postcode: body.delivery_address_postcode || "",
            },
            specialInstructions:
              body.forklift_available === false
                ? "Tailgate truck required - no forklift on site"
                : undefined,
            // Machship question 7 = "Hydraulic Tailgate required".
            questionIds: body.forklift_available === false ? [7] : [],
            dgsDeclaration: isDg,
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
            quote_amount: body.macship_quote_amount,
            governing_product_id: pickupResult.governingProductId || undefined,
            used_fallback: pickupResult.usedFallback,
            failed: false,
          }
        }
      }
    } catch (macshipError) {
      console.error(
        "Machship consignment creation failed (non-blocking):",
        macshipError,
      )
      macshipData = { failed: true }
    }

    if (
      macshipData.consignment_id ||
      macshipData.failed ||
      macshipData.pickup_date ||
      macshipData.carrier_id
    ) {
      supabase
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
        .then(() => {})
    }

    const { error: cartError } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id)

    if (cartError) {
      console.error(
        "Failed to clear cart after order creation:",
        cartError.message,
      )
    }

    const customerName = userProfile?.contact_name || "Customer"
    const customerEmail = userProfile?.email || user.email || ""

    // PO orders get an "under review" confirmation; the branded receipt
    // and order confirmation emails wait until admin approval.
    sendEmail({
      to: customerEmail,
      subject: `Order #${order.order_number} Received - Under Review`,
      heading: "Your Order is Under Review",
      preheader: `Order #${order.order_number} has been received and is awaiting approval.`,
      sections: [
        {
          title: "What happens next?",
          content: `
            <p>Hi ${customerName},</p>
            <p>Thank you for your order. My team is reviewing it and will approve it within 24 hours.</p>
            <p><strong>Order Number:</strong> ${order.order_number}</p>
            ${body.po_number ? `<p><strong>PO Number:</strong> ${body.po_number}</p>` : ""}
            <p>Once approved, you will receive an invoice and your order will be processed for delivery.</p>
            <p>If you have any questions, please don&apos;t hesitate to contact us.</p>
          `,
        },
      ],
    })

    notifyAdminNewOrder({
      customerName,
      customerEmail,
      companyName: userProfile?.company_name ?? undefined,
      orderNumber: order.order_number,
      total: calc.calculated.total,
      paymentMethod: "Purchase Order",
      itemCount: calc.orderItems.length,
    })

    // Bonus credit promo emails (PO path only; card orders send these
    // from finalize after the payment succeeds).
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
              content: `<p><strong>Customer:</strong> ${customerName}</p><p><strong>Email:</strong> ${customerEmail}</p><p><strong>Company:</strong> ${userProfile?.company_name || "N/A"}</p><p><strong>Order:</strong> #${order.order_number}</p><p><strong>Order total:</strong> AUD ${calc.calculated.total.toFixed(2)}</p><ul style="padding-left: 20px; margin: 10px 0;">${creditSummary}</ul><p>Please arrange the store credit for this customer. The customer has been notified and is expecting to hear from you.</p>`,
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

    // Referral auto-conversion. Service role bypasses RLS so the buyer
    // doesn't need visibility into other users' referral rows.
    const serviceSupabase = createServiceRoleClient()

    if (customerEmail) {
      const { data: pendingReferrals } = await serviceSupabase
        .from("referrals")
        .select(
          "id, referrer_id, referrer_name, referred_site_name, referred_contact_name, status",
        )
        .eq("referred_email", customerEmail)
        .in("status", ["pending", "contacted"])

      if (pendingReferrals && pendingReferrals.length > 0) {
        for (const ref of pendingReferrals as Array<{
          id: string
          referrer_id: string | null
          referrer_name: string | null
          referred_site_name: string
          referred_contact_name: string
        }>) {
          await serviceSupabase
            .from("referrals")
            .update({ status: "converted", reward_given: false })
            .eq("id", ref.id)

          if (ref.referrer_id) {
            const { data: referrerProfile } = await serviceSupabase
              .from("profiles")
              .select("email, contact_name")
              .eq("id", ref.referrer_id)
              .maybeSingle()

            const { count: convertedCount } = await serviceSupabase
              .from("referrals")
              .select("*", { count: "exact", head: true })
              .eq("referrer_id", ref.referrer_id)
              .eq("status", "converted")

            const totalConverted = convertedCount ?? 0
            const referrerEmail = referrerProfile?.email
            const referrerName =
              referrerProfile?.contact_name || ref.referrer_name
            const appUrl =
              process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

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
                heading:
                  milestoneTitle || "Your Referral Just Placed an Order!",
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

    // PO orders skip Xero PO here - it's created on admin approval,
    // after the invoice has been raised and agreed on terms.

    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    console.error("POST /api/orders error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
