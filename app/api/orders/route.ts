import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { getStripeServer } from "@/lib/stripe"
import {
  sendOrderConfirmationEmail,
  notifyAdminNewOrder,
} from "@/lib/email/notifications"
import { sendReceiptEmail } from "@/lib/email/receipt-email"
import { sendEmail, getAdminEmail } from "@/lib/email/send"

const GST_RATE = 0.1
const STRIPE_FEE_PERCENT = 0.0175 // 1.75% for domestic AU cards
const STRIPE_FEE_FIXED = 0.30 // 30 cents per transaction
const STRIPE_FEE_GST = 0.10 // 10% GST on Stripe fee itself

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

    // Check if user is admin
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

    // For admin, fetch profiles for all unique user_ids
    let profileMap = new Map<string, { email: string; company_name: string | null; contact_name: string | null; phone: string | null }>()

    if (isAdmin && data && data.length > 0) {
      const userIds = [...new Set(data.map((o) => o.user_id))]
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, company_name, contact_name, phone")
        .in("id", userIds)

      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, { email: p.email, company_name: p.company_name, contact_name: p.contact_name, phone: p.phone })
        }
      }
    }

    // Transform response to match Order type
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
    const {
      payment_method,
      po_number,
      items,
      delivery_address_street,
      delivery_address_city,
      delivery_address_state,
      delivery_address_postcode,
      delivery_notes,
    } = body

    if (!payment_method || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "payment_method and items are required" },
        { status: 400 },
      )
    }

    if (!["stripe", "purchase_order"].includes(payment_method)) {
      return NextResponse.json(
        { error: "payment_method must be 'stripe' or 'purchase_order'" },
        { status: 400 },
      )
    }

    // Fetch product details for shipping fees and order items snapshot
    const productIds = items.map((item: { product_id: string }) => item.product_id)
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, image_url, unit, shipping_fee, price")
      .in("id", productIds)

    const productMap = new Map(
      (productsData ?? []).map((p: { id: string; name: string; image_url: string | null; unit: string; shipping_fee?: number; price: number }) => [p.id, p]),
    )

    // Calculate subtotal
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unit_price: number }) =>
        sum + item.quantity * item.unit_price,
      0,
    )

    // Calculate bundle discount server-side (independent of client calculation)
    const { data: activeBundles } = await supabase
      .from("product_bundles")
      .select("id, name, discount_percent, min_products, badge_text, is_active, bundle_products (product_id)")
      .eq("is_active", true)

    let bundleDiscount = 0
    if (activeBundles && activeBundles.length > 0) {
      const uniqueProductIds = [...new Set(productIds as string[])]
      // Sort by highest discount first
      const sortedBundles = [...activeBundles].sort((a, b) => b.discount_percent - a.discount_percent)
      const claimed = new Set<string>()

      for (const bundle of sortedBundles) {
        const bundleProductIds = (bundle.bundle_products as { product_id: string }[])?.map(bp => bp.product_id) ?? []

        if (bundleProductIds.length > 0) {
          const matching = bundleProductIds.filter(pid => uniqueProductIds.includes(pid) && !claimed.has(pid))
          if (matching.length >= bundle.min_products) {
            for (const pid of matching) {
              claimed.add(pid)
              const item = items.find((i: { product_id: string }) => i.product_id === pid)
              if (item) {
                bundleDiscount += (item.unit_price * item.quantity) * (bundle.discount_percent / 100)
              }
            }
          }
        } else {
          const unclaimed = uniqueProductIds.filter(pid => !claimed.has(pid))
          if (unclaimed.length >= bundle.min_products) {
            for (const pid of unclaimed) {
              claimed.add(pid)
              const item = items.find((i: { product_id: string }) => i.product_id === pid)
              if (item) {
                bundleDiscount += (item.unit_price * item.quantity) * (bundle.discount_percent / 100)
              }
            }
          }
        }
      }
      bundleDiscount = Math.round(bundleDiscount * 100) / 100
    }

    // Calculate shipping from per-product fees
    const shippingMap = new Map(
      (productsData ?? []).map((p: { id: string; shipping_fee?: number }) => [p.id, p.shipping_fee ?? 0]),
    )
    const shipping = Math.round(
      items.reduce(
        (sum: number, item: { product_id: string }) => sum + (shippingMap.get(item.product_id) ?? 0),
        0,
      ) * 100,
    ) / 100

    // First-order incentive
    let firstOrderDiscount = 0
    let firstOrderFreeFreight = false
    const TRUCK_WASH_SLUGS = ["truck-wash-standard", "truck-wash-premium"]
    const firstOrderChoice = body.first_order_choice as string | undefined
    const firstOrderTruckWash = body.first_order_truck_wash as string | undefined

    // Check if user has any previous orders
    const { count: previousOrderCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    if ((previousOrderCount ?? 0) === 0 && firstOrderChoice) {
      if (firstOrderChoice === "free_freight") {
        firstOrderFreeFreight = true
        await supabase
          .from("customer_rewards")
          .update({
            first_order_incentive_used: true,
            first_order_incentive_type: "free_freight",
          })
          .eq("user_id", user.id)
      } else if (firstOrderChoice === "half_price_truck_wash" && firstOrderTruckWash) {
        // Only discount the ONE selected truck wash product
        const { data: selectedTW } = await supabase
          .from("products")
          .select("id")
          .eq("slug", firstOrderTruckWash)
          .maybeSingle()

        if (selectedTW) {
          const matchingItem = (items as { product_id: string; quantity: number; unit_price: number }[])
            .find(i => i.product_id === selectedTW.id)

          if (matchingItem) {
            firstOrderDiscount = Math.round(matchingItem.unit_price * matchingItem.quantity * 0.5 * 100) / 100
          }
        }

        if (firstOrderDiscount > 0) {
          await supabase
            .from("customer_rewards")
            .update({
              first_order_incentive_used: true,
              first_order_incentive_type: "half_price_truck_wash",
            })
            .eq("user_id", user.id)
        }
      }
    }

    // Promotion discounts (server-side calculation)
    let promoDiscount = 0
    let promoFreeFreight = false
    const qualifiedBonusCredits: { promoName: string; headline: string | null; creditPercent: number; eligibleTotal: number; creditAmount: number }[] = []

    const { data: activePromos } = await supabase
      .from("promotions")
      .select("*")
      .eq("is_active", true)

    if (activePromos && activePromos.length > 0) {
      const now = new Date()
      const subtotalAfterBundlesAndFirst = subtotal - bundleDiscount - firstOrderDiscount

      for (const promo of activePromos) {
        // Date range check
        if (promo.start_date && new Date(promo.start_date) > now) continue
        if (promo.end_date) {
          const end = new Date(promo.end_date)
          end.setHours(23, 59, 59, 999)
          if (end < now) continue
        }

        // Min order check
        if (promo.min_order_value > 0 && subtotalAfterBundlesAndFirst < promo.min_order_value) continue

        // Eligible products check
        const eligibleIds: string[] = promo.eligible_product_ids ?? []
        const hasFilter = eligibleIds.length > 0
        const typedItems = items as { product_id: string; quantity: number; unit_price: number }[]
        const eligibleItems = hasFilter
          ? typedItems.filter((i) => eligibleIds.includes(i.product_id))
          : typedItems

        if (hasFilter && eligibleItems.length === 0) continue

        switch (promo.discount_type) {
          case "percentage": {
            const eligibleTotal = eligibleItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
            promoDiscount += eligibleTotal * (promo.discount_value / 100)
            break
          }
          case "fixed": {
            promoDiscount += Math.min(promo.discount_value, subtotalAfterBundlesAndFirst)
            break
          }
          case "free_freight": {
            promoFreeFreight = true
            break
          }
          case "buy_x_get_y": {
            const buyQty = promo.buy_quantity || 3
            const totalQty = eligibleItems.reduce((s, i) => s + i.quantity, 0)
            if (totalQty > buyQty) {
              const freeQty = totalQty - buyQty
              const prices = eligibleItems
                .flatMap((i) => Array.from({ length: i.quantity }, () => i.unit_price))
                .sort((a, b) => a - b)
              const discountedPrices = prices.slice(0, freeQty)
              promoDiscount += discountedPrices.reduce((s, p) => s + p * (promo.discount_value / 100), 0)
            }
            break
          }
          case "bonus_credit": {
            const eligibleTotal = eligibleItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
            const creditAmount = Math.round(eligibleTotal * (promo.discount_value / 100) * 100) / 100
            if (creditAmount > 0) {
              qualifiedBonusCredits.push({
                promoName: promo.name,
                headline: promo.headline,
                creditPercent: promo.discount_value,
                eligibleTotal,
                creditAmount,
              })
            }
            break
          }
        }
      }
      promoDiscount = Math.round(promoDiscount * 100) / 100
    }

    // Collect promo names for order record
    const appliedPromoNames = activePromos
      ?.filter(p => {
        const now = new Date()
        if (!p.is_active) return false
        if (p.start_date && new Date(p.start_date) > now) return false
        if (p.end_date) { const end = new Date(p.end_date); end.setHours(23,59,59,999); if (end < now) return false }
        const eligibleIds: string[] = p.eligible_product_ids ?? []
        const hasFilter = eligibleIds.length > 0
        const typedItems = items as { product_id: string }[]
        const eligibleItems = hasFilter ? typedItems.filter(i => eligibleIds.includes(i.product_id)) : typedItems
        if (hasFilter && eligibleItems.length === 0) return false
        return true
      })
      .map(p => p.headline || p.name)
      .join(", ") || null

    const effectiveShipping = (firstOrderFreeFreight || promoFreeFreight) ? 0 : shipping
    const totalDiscount = bundleDiscount + firstOrderDiscount + promoDiscount
    const gst = Math.round((subtotal - totalDiscount + effectiveShipping) * GST_RATE * 100) / 100
    // Processing fee only for card payments
    let processingFee = 0
    if (payment_method === "stripe") {
      const stripeFee = (subtotal - totalDiscount + effectiveShipping + gst) * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED
      const feeGst = stripeFee * STRIPE_FEE_GST
      processingFee = Math.round((stripeFee + feeGst) * 100) / 100
    }
    const total = Math.round((subtotal - totalDiscount + effectiveShipping + gst + processingFee) * 100) / 100

    let clientSecret: string | null = null
    let stripePaymentIntentId: string | null = null

    // For stripe payments, create a PaymentIntent
    if (payment_method === "stripe") {
      const paymentIntent = await getStripeServer().paymentIntents.create({
        amount: Math.round(total * 100), // Stripe expects cents
        currency: "aud",
        metadata: {
          user_id: user.id,
        },
      })
      clientSecret = paymentIntent.client_secret
      stripePaymentIntentId = paymentIntent.id
    }

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "received",
        payment_method,
        payment_status: "pending",
        po_number: po_number || null,
        stripe_payment_intent_id: stripePaymentIntentId,
        subtotal,
        shipping: effectiveShipping,
        gst,
        processing_fee: processingFee,
        total,
        bundle_discount: bundleDiscount || 0,
        first_order_discount: firstOrderDiscount || 0,
        first_order_type: firstOrderChoice || null,
        promo_discount: promoDiscount || 0,
        promo_names: appliedPromoNames,
        delivery_address_street: delivery_address_street || null,
        delivery_address_city: delivery_address_city || null,
        delivery_address_state: delivery_address_state || null,
        delivery_address_postcode: delivery_address_postcode || null,
        delivery_notes: delivery_notes || null,
      })
      .select()
      .single()

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 })
    }

    // Insert order items with product snapshot data
    const orderItems = items.map(
      (item: {
        product_id: string
        quantity: number
        packaging_size: string
        unit_price: number
      }) => {
        const product = productMap.get(item.product_id)
        return {
          order_id: order.id,
          product_id: item.product_id,
          product_name: product?.name ?? "Unknown Product",
          product_image_url: product?.image_url ?? null,
          unit: product?.unit ?? "L",
          quantity: item.quantity,
          packaging_size: item.packaging_size,
          unit_price: item.unit_price,
          total_price: Math.round(item.quantity * item.unit_price * 100) / 100,
          shipping_fee: product?.shipping_fee ?? 0,
        }
      },
    )

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems)

    if (itemsError) {
      // Clean up the order if items insertion fails
      await supabase.from("orders").delete().eq("id", order.id)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    // Clear user's cart
    const { error: cartError } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id)

    if (cartError) {
      console.error("Failed to clear cart after order creation:", cartError.message)
    }

    // Get user profile for email
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("contact_name, email, company_name")
      .eq("id", user.id)
      .single()

    const customerName = userProfile?.contact_name || "Customer"
    const customerEmail = userProfile?.email || user.email || ""

    // Send order confirmation email to customer (non-blocking)
    if (payment_method === "purchase_order") {
      sendOrderConfirmationEmail(customerEmail, {
        customerName,
        orderNumber: order.order_number,
        items: orderItems.map((item) => ({
          name: item.product_name,
          qty: item.quantity,
          unitPrice: item.unit_price,
          total: item.total_price,
          shippingFee: effectiveShipping === 0 ? 0 : (shippingMap.get(item.product_id) ?? 0),
        })),
        subtotal,
        shipping: effectiveShipping,
        gst,
        processingFee,
        total,
        paymentMethod: "Purchase Order",
        poNumber: po_number,
      })

      // Send invoice/receipt for PO orders
      sendReceiptEmail(customerEmail, {
        customerName,
        companyName: userProfile?.company_name || undefined,
        customerEmail,
        orderNumber: order.order_number,
        date: new Date().toLocaleDateString("en-AU", {
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
          shippingFee: effectiveShipping === 0 ? 0 : (shippingMap.get(item.product_id) ?? 0),
        })),
        subtotal,
        shipping: effectiveShipping,
        gst,
        processingFee,
        total,
        paymentMethod: "Purchase Order",
        poNumber: po_number,
        deliveryAddress: [
          delivery_address_street,
          delivery_address_city,
          delivery_address_state,
          delivery_address_postcode,
        ].filter(Boolean).join(", ") || undefined,
      })
    }

    // Notify admin of new order (non-blocking)
    notifyAdminNewOrder({
      customerName,
      customerEmail,
      companyName: userProfile?.company_name ?? undefined,
      orderNumber: order.order_number,
      total,
      paymentMethod: payment_method === "stripe" ? "Card Payment" : "Purchase Order",
      itemCount: orderItems.length,
    })

    // --- Bonus Credit Promotion Emails ---
    // Only send for PO orders here. Stripe orders send from /confirm endpoint after payment.
    if (qualifiedBonusCredits.length > 0 && customerEmail && payment_method === "purchase_order") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

      for (const bc of qualifiedBonusCredits) {
        // Email to customer
        sendEmail({
          to: customerEmail,
          subject: `You've Qualified for Store Credit! - Chem Connect`,
          heading: bc.headline || `${bc.promoName} - Store Credit Earned!`,
          preheader: `Your order qualifies for ${bc.creditPercent}% store credit ($${bc.creditAmount.toFixed(2)}).`,
          sections: [
            {
              title: "Congratulations!",
              content: `
                <p>Hi ${customerName},</p>
                <p>Your order <strong>#${order.order_number}</strong> qualifies for our <strong>${bc.promoName}</strong> promotion!</p>
                <p>You've earned <strong>${bc.creditPercent}% store credit</strong> worth <strong>$${bc.creditAmount.toFixed(2)}</strong> on eligible products in this order.</p>
              `,
            },
            {
              title: "What Happens Next",
              content: `
                <p>Our team at Chem Connect will be reaching out to you shortly to apply your store credit. Please wait patiently while we process your reward.</p>
                <p>If for any reason our team doesn't reach out to you within a few business days, please don't hesitate to contact us directly.</p>
                <p>You can reach us through your <a href="${appUrl}/dashboard/rewards" style="color: #52c77d; text-decoration: underline;">rewards dashboard</a> or by replying to this email.</p>
              `,
            },
          ],
          ctaButton: { text: "View Your Orders", url: `${appUrl}/dashboard/orders` },
          footerNote: `You're receiving this because your order qualified for the ${bc.promoName} seasonal promotion on Chem Connect.`,
        }).catch(() => {})
      }

      // Email to admin about bonus credit qualifications
      const adminEmail = await getAdminEmail()
      if (adminEmail) {
        const creditSummary = qualifiedBonusCredits.map(bc =>
          `<li><strong>${bc.promoName}</strong>: ${bc.creditPercent}% credit on $${bc.eligibleTotal.toFixed(2)} eligible products = <strong>$${bc.creditAmount.toFixed(2)} credit</strong></li>`
        ).join("")

        sendEmail({
          to: adminEmail,
          subject: `Bonus Credit Earned - Order #${order.order_number}`,
          heading: "Customer Earned Bonus Store Credit",
          preheader: `${customerName} qualified for bonus credit on order #${order.order_number}.`,
          sections: [
            {
              title: "Order & Credit Details",
              content: `
                <p><strong>Customer:</strong> ${customerName}</p>
                <p><strong>Email:</strong> ${customerEmail}</p>
                <p><strong>Company:</strong> ${userProfile?.company_name || "N/A"}</p>
                <p><strong>Order:</strong> #${order.order_number}</p>
                <p><strong>Order total:</strong> $${total.toFixed(2)}</p>
                <ul style="padding-left: 20px; margin: 10px 0;">${creditSummary}</ul>
                <p>Please arrange the store credit for this customer. The customer has been notified and is expecting to hear from you.</p>
              `,
            },
          ],
          ctaButton: { text: "View Orders", url: `${appUrl}/admin/orders` },
          footerNote: "Auto-generated when an order qualifies for a bonus credit promotion.",
        }).catch(() => {})
      }
    }

    // --- Referral auto-conversion ---
    // Use service role to bypass RLS (buyer can't see other users' referrals)
    const { createClient: createServiceClient } = await import("@supabase/supabase-js")
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    if (customerEmail) {
      const { data: pendingReferrals } = await serviceSupabase
        .from("referrals")
        .select("id, referrer_id, referrer_name, referred_site_name, referred_contact_name, status")
        .eq("referred_email", customerEmail)
        .in("status", ["pending", "contacted"])

      if (pendingReferrals && pendingReferrals.length > 0) {
        for (const ref of pendingReferrals) {
          // Auto-convert
          await serviceSupabase
            .from("referrals")
            .update({ status: "converted", reward_given: false })
            .eq("id", ref.id)

          // Get referrer's profile for email
          if (ref.referrer_id) {
            const { data: referrerProfile } = await serviceSupabase
              .from("profiles")
              .select("email, contact_name")
              .eq("id", ref.referrer_id)
              .maybeSingle()

            // Count total converted referrals for this referrer
            const { count: convertedCount } = await serviceSupabase
              .from("referrals")
              .select("*", { count: "exact", head: true })
              .eq("referrer_id", ref.referrer_id)
              .eq("status", "converted")

            const totalConverted = convertedCount ?? 0
            const referrerEmail = referrerProfile?.email
            const referrerName = referrerProfile?.contact_name || ref.referrer_name
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

            if (referrerEmail) {
              // Determine which milestone was just hit
              let milestoneTitle = ""
              let milestoneReward = ""

              if (totalConverted === 1) {
                milestoneTitle = "Your First Referral Converted!"
                milestoneReward = "You've earned a <strong>free 200L drum of Truck Wash Standard or Premium</strong>."
              } else if (totalConverted === 3) {
                milestoneTitle = "3 Referrals Converted - Free Freight Unlocked!"
                milestoneReward = "All 3 of your referred customers have placed orders. You've earned <strong>free freight for a full quarter</strong>."
              } else if (totalConverted === 5) {
                milestoneTitle = "5 Referrals - Ambassador Status Achieved!"
                milestoneReward = "All 5 of your referred customers have placed orders. You now qualify for a <strong>permanent 5% discount</strong> on all future orders."
              }

              const contactSection = {
                title: "What Happens Next",
                content: `
                  <p>Our team at Chem Connect will be reaching out to you shortly to arrange your reward. If for any reason you don't hear from us within a few business days, please don't hesitate to get in touch with us directly.</p>
                  <p>You can contact us anytime through your <a href="${appUrl}/dashboard/rewards" style="color: #52c77d; text-decoration: underline;">rewards dashboard</a> or by replying to this email.</p>
                `,
              }

              // Always send conversion notification
              sendEmail({
                to: referrerEmail,
                subject: `${ref.referred_site_name} just placed an order! - Chem Connect`,
                heading: milestoneTitle || "Your Referral Just Placed an Order!",
                preheader: `${ref.referred_contact_name} from ${ref.referred_site_name} has placed their first order on Chem Connect.`,
                sections: [
                  {
                    title: "Referral Converted",
                    content: `
                      <p>Hi ${referrerName},</p>
                      <p>Great news! <strong>${ref.referred_contact_name}</strong> from <strong>${ref.referred_site_name}</strong> just placed their first order on Chem Connect.</p>
                      <p>You now have <strong>${totalConverted} converted referral${totalConverted > 1 ? "s" : ""}</strong>.</p>
                    `,
                  },
                  ...(milestoneReward ? [{
                    title: "Your Reward",
                    content: `<p>${milestoneReward}</p>`,
                  }] : [{
                    content: `<p>Keep referring! ${totalConverted < 3 ? `${3 - totalConverted} more to unlock free freight for a quarter.` : totalConverted < 5 ? `${5 - totalConverted} more to unlock Ambassador status with a permanent 5% discount.` : "You're an Ambassador - enjoy your 5% discount!"}</p>`,
                  }]),
                  contactSection,
                ],
                ctaButton: {
                  text: "View Your Rewards",
                  url: `${appUrl}/dashboard/rewards`,
                },
                footerNote: "You're receiving this because someone you referred just placed their first order on Chem Connect.",
              }).catch(() => {})

              // Also notify admin
              const adminEmail = await getAdminEmail()
              if (adminEmail) {
                sendEmail({
                  to: adminEmail,
                  subject: `Referral Auto-Converted - ${ref.referred_site_name}`,
                  heading: "Referral Auto-Converted",
                  preheader: `${ref.referred_contact_name} placed an order. Referral by ${referrerName} has been converted.`,
                  sections: [{
                    title: "Details",
                    content: `
                      <p><strong>Referred by:</strong> ${referrerName} (${referrerEmail})</p>
                      <p><strong>Referred site:</strong> ${ref.referred_site_name}</p>
                      <p><strong>Contact:</strong> ${ref.referred_contact_name} (${customerEmail})</p>
                      <p><strong>Referrer's total conversions:</strong> ${totalConverted}</p>
                      ${milestoneTitle ? `<p style="color: #52c77d;"><strong>Milestone hit:</strong> ${milestoneTitle}</p>` : ""}
                    `,
                  }],
                  ctaButton: { text: "View Referrals", url: `${appUrl}/admin/rewards` },
                  footerNote: "Auto-converted because the referred customer placed their first order.",
                }).catch(() => {})
              }
            }
          }
        }
      }
    }

    return NextResponse.json(
      {
        ...order,
        client_secret: clientSecret,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error("POST /api/orders error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
