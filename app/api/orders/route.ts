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
import { isMacShipConfigured, createConsignment } from "@/lib/macship/client"
import { getOrderPickupDate } from "@/lib/macship/lead-time"
import {
  buildConsolidatedCart,
  buildCapacityMap,
} from "@/lib/macship/pallet-consolidation"

// ============================================================
// Machship helpers
// ============================================================

function isDgClassification(classification: string | null | undefined): boolean {
  if (!classification) return false
  const c = classification.toLowerCase()
  return c !== "non-dg" && c !== "non dg" && c !== "none" && c !== ""
}

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
      invoice_email,
      forklift_available,
      items,
      delivery_address_street,
      delivery_address_city,
      delivery_address_state,
      delivery_address_postcode,
      delivery_notes,
    } = body
    const macship_carrier_id = body.macship_carrier_id as string | undefined
    const macship_quote_amount = body.macship_quote_amount as number | undefined
    const macship_shipping_breakdown = body.macship_shipping_breakdown as Record<string, unknown> | null | undefined
    const macship_service_name = body.macship_service_name as string | null | undefined
    const macship_eta_date = body.macship_eta_date as string | null | undefined
    const macship_eta_business_days = body.macship_eta_business_days as number | null | undefined

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

    // Validate MOQ for each item that has a packaging_size_id
    const itemsWithSize = (items as Array<{ product_id: string; packaging_size_id?: string; quantity: number }>)
      .filter((i) => i.packaging_size_id)
    if (itemsWithSize.length > 0) {
      const { data: moqRows } = await supabase
        .from("product_packaging_prices")
        .select("product_id, packaging_size_id, minimum_order_quantity")
        .in("product_id", itemsWithSize.map((i) => i.product_id))

      for (const item of itemsWithSize) {
        const row = moqRows?.find(
          (r) => r.product_id === item.product_id && r.packaging_size_id === item.packaging_size_id,
        )
        const moq = row?.minimum_order_quantity ?? 1
        if (item.quantity < moq) {
          return NextResponse.json(
            { error: `Minimum order quantity for one or more items is not met (minimum: ${moq}).`, moq },
            { status: 400 },
          )
        }
      }
    }

    // Fetch product details for shipping fees and order items snapshot
    const productIds = items.map((item: { product_id: string }) => item.product_id)
    const { data: productsData } = await supabase
      .from("products")
      .select("id, name, image_url, unit, shipping_fee, price, price_type, classification")
      .in("id", productIds)

    const productMap = new Map(
      (productsData ?? []).map((p: { id: string; name: string; image_url: string | null; unit: string; shipping_fee?: number; price: number; price_type?: string; classification?: string | null }) => [p.id, p]),
    )

    // Compute container costs server-side
    // Pull all container costs once - small table, OK to fetch all
    const { data: allContainerCosts } = await supabase
      .from("container_costs")
      .select("warehouse_id, packaging_size_id, cost")

    // Determine the warehouse for this order. For now, pick the first active
    // warehouse matching the delivery state, or fall back to the first active one.
    // A more sophisticated closest-warehouse algorithm will land with MacShip.
    const { data: warehousesData } = await supabase
      .from("warehouses")
      .select("id, address_state, address_street, address_city, address_postcode, name, contact_phone, contact_email")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    const selectedWarehouse =
      warehousesData?.find(
        (w) => w.address_state === delivery_address_state,
      ) ?? warehousesData?.[0] ?? null

    const containerCostMap = new Map<string, number>()
    if (selectedWarehouse) {
      for (const cc of allContainerCosts ?? []) {
        if (cc.warehouse_id === selectedWarehouse.id) {
          containerCostMap.set(cc.packaging_size_id, Number(cc.cost) || 0)
        }
      }
    }

    let containerTotal = 0
    for (const item of items as Array<{ packaging_size_id?: string; quantity: number }>) {
      if (item.packaging_size_id) {
        const cost = containerCostMap.get(item.packaging_size_id) ?? 0
        containerTotal += cost * item.quantity
      }
    }
    containerTotal = Math.round(containerTotal * 100) / 100

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

    // Shipping: prefer the live Machship quote amount sent from checkout,
    // fall back to per-product shipping_fee legacy calculation only if the
    // quote is missing (e.g. direct API clients without a quote step).
    const shippingMap = new Map(
      (productsData ?? []).map((p: { id: string; shipping_fee?: number }) => [p.id, p.shipping_fee ?? 0]),
    )
    const legacyShipping = Math.round(
      items.reduce(
        (sum: number, item: { product_id: string }) => sum + (shippingMap.get(item.product_id) ?? 0),
        0,
      ) * 100,
    ) / 100
    const shipping =
      typeof macship_quote_amount === "number" && macship_quote_amount > 0
        ? Math.round(macship_quote_amount * 100) / 100
        : legacyShipping

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

    // Free freight is capped at $500 (confirmed by Jonny, April 2026).
    const FREE_FREIGHT_CAP = 500
    const isFreeFreight = firstOrderFreeFreight || promoFreeFreight
    const effectiveShipping = isFreeFreight
      ? Math.max(0, Math.round((shipping - FREE_FREIGHT_CAP) * 100) / 100)
      : shipping
    const totalDiscount = bundleDiscount + firstOrderDiscount + promoDiscount
    const gst = Math.round(
      (subtotal - totalDiscount + containerTotal + effectiveShipping) * GST_RATE * 100,
    ) / 100
    // Processing fee only for card payments
    let processingFee = 0
    if (payment_method === "stripe") {
      const stripeFee = (subtotal - totalDiscount + containerTotal + effectiveShipping + gst) * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED
      const feeGst = stripeFee * STRIPE_FEE_GST
      processingFee = Math.round((stripeFee + feeGst) * 100) / 100
    }
    const total = Math.round(
      (subtotal - totalDiscount + containerTotal + effectiveShipping + gst + processingFee) * 100,
    ) / 100

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
        status: payment_method === "purchase_order" ? "pending_approval" : "received",
        payment_method,
        payment_status: "pending",
        po_number: po_number || null,
        stripe_payment_intent_id: stripePaymentIntentId,
        subtotal,
        shipping: effectiveShipping,
        gst,
        processing_fee: processingFee,
        container_total: containerTotal,
        total,
        bundle_discount: bundleDiscount || 0,
        first_order_discount: firstOrderDiscount || 0,
        first_order_type: firstOrderChoice || null,
        promo_discount: promoDiscount || 0,
        promo_names: appliedPromoNames,
        invoice_email: invoice_email || null,
        forklift_available:
          typeof forklift_available === "boolean" ? forklift_available : null,
        warehouse_id: selectedWarehouse?.id ?? null,
        delivery_address_street: delivery_address_street || null,
        delivery_address_city: delivery_address_city || null,
        delivery_address_state: delivery_address_state || null,
        delivery_address_postcode: delivery_address_postcode || null,
        delivery_notes: delivery_notes || null,
        macship_shipping_breakdown: macship_shipping_breakdown ?? null,
        macship_service_name: macship_service_name ?? null,
        macship_eta_date: macship_eta_date ?? null,
        macship_eta_business_days: macship_eta_business_days ?? null,
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
        packaging_size_id?: string
        unit_price: number
      }) => {
        const product = productMap.get(item.product_id)
        const containerCost = item.packaging_size_id
          ? containerCostMap.get(item.packaging_size_id) ?? 0
          : 0
        return {
          order_id: order.id,
          product_id: item.product_id,
          product_name: product?.name ?? "Unknown Product",
          product_image_url: product?.image_url ?? null,
          unit: product?.unit ?? "L",
          quantity: item.quantity,
          packaging_size: item.packaging_size,
          packaging_size_id: item.packaging_size_id ?? null,
          price_type: product?.price_type ?? null,
          unit_price: item.unit_price,
          total_price: Math.round(item.quantity * item.unit_price * 100) / 100,
          shipping_fee: product?.shipping_fee ?? 0,
          container_cost: containerCost,
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

    // Get user profile (needed for MacShip delivery name and email notifications)
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("contact_name, email, company_name, phone")
      .eq("id", user.id)
      .single()

    // --- MacShip Consignment Creation (non-blocking) ---
    // We don't block order creation on MacShip failure - just flag it
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
      if (selectedWarehouse) {
        // Get pickup date from lead time calculation (works without Machship token)
        const pickupResult = await getOrderPickupDate(
          items.map((i: { product_id: string; quantity: number }) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          selectedWarehouse.id,
          selectedWarehouse.address_state,
          supabase,
        )

        // Always record what we know from the quote, even if Machship token is missing.
        // This lets the admin order page show pickup date and quoted carrier so the
        // rest of the flow (dispatch button, lead time sync) can be tested without
        // a real consignment.
        macshipData = {
          carrier_id: macship_carrier_id || undefined,
          quote_amount: macship_quote_amount,
          pickup_date: pickupResult.pickupDate,
          governing_product_id: pickupResult.governingProductId || undefined,
          used_fallback: pickupResult.usedFallback,
          failed: false,
        }
      }

      if (isMacShipConfigured() && selectedWarehouse) {
        const pickupResult = await getOrderPickupDate(
          items.map((i: { product_id: string; quantity: number }) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          selectedWarehouse.id,
          selectedWarehouse.address_state,
          supabase,
        )

        // Fetch packaging_sizes capacity for the order so admin-configured
        // pallet capacities take precedence over the hardcoded fallbacks.
        const orderPackagingSizeIds = [
          ...new Set(
            orderItems
              .map((oi) => oi.packaging_size_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ]
        const { data: orderPackagingSizesData } = orderPackagingSizeIds.length > 0
          ? await supabase
              .from("packaging_sizes")
              .select("id, name, units_per_pallet, unit_weight_kg")
              .in("id", orderPackagingSizeIds)
          : { data: [] as Array<{ id: string; name: string; units_per_pallet: number | null; unit_weight_kg: number | null }> }
        const orderCapacityMap = buildCapacityMap(orderPackagingSizesData ?? [])

        // Build Machship items via the whole-cart consolidation helper.
        // Groups lines sharing a packaging size onto shared pallets
        // (CQVS' "Option B" pricing rule - approved April 2026).
        const machshipItems = buildConsolidatedCart(
          orderItems.map((oi) => {
            const product = productMap.get(oi.product_id)
            return {
              product_name: product?.name ?? oi.product_name,
              packaging_size_name: oi.packaging_size,
              packaging_size_id: oi.packaging_size_id,
              quantity: oi.quantity,
            }
          }),
          orderCapacityMap,
        )

        // Carrier ID is selected from the quote response on the checkout page
        const carrierId = macship_carrier_id ? parseInt(macship_carrier_id, 10) : null
        const isDg = orderItems.some((oi) =>
          isDgClassification(productMap.get(oi.product_id)?.classification),
        )

        if (carrierId && !Number.isNaN(carrierId) && machshipItems.length > 0) {
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
              userProfile?.company_name || userProfile?.contact_name || "Customer",
            toContact: userProfile?.contact_name || undefined,
            toPhone: userProfile?.phone || undefined,
            toEmail: userProfile?.email || undefined,
            toAddressLine1: delivery_address_street || "",
            toLocation: {
              suburb: delivery_address_city || "",
              postcode: delivery_address_postcode || "",
            },
            specialInstructions: forklift_available === false
              ? "Tailgate truck required - no forklift on site"
              : undefined,
            // Question ID 7 = "Hydraulic Tailgate required" in Machship.
            questionIds: forklift_available === false ? [7] : [],
            dgsDeclaration: isDg,
            items: machshipItems,
          })

          // Build a tracking URL from the response token if available
          const trackingUrl = consignmentResult.trackingPageAccessToken
            ? `https://mship.io/v2/${consignmentResult.trackingPageAccessToken}`
            : ""

          macshipData = {
            consignment_id: String(consignmentResult.id),
            carrier_id: String(consignmentResult.carrier?.id ?? carrierId),
            tracking_url: trackingUrl,
            pickup_date: pickupResult.pickupDate,
            quote_amount: macship_quote_amount,
            governing_product_id: pickupResult.governingProductId || undefined,
            used_fallback: pickupResult.usedFallback,
            failed: false,
          }
        }
      }
    } catch (macshipError) {
      console.error("Machship consignment creation failed (non-blocking):", macshipError)
      macshipData = { failed: true }
    }

    // Update order with MacShip data (separate update, non-blocking)
    if (
      macshipData.consignment_id ||
      macshipData.failed ||
      macshipData.pickup_date ||
      macshipData.carrier_id
    ) {
      supabase.from("orders").update({
        macship_consignment_id: macshipData.consignment_id || null,
        macship_carrier_id: macshipData.carrier_id || null,
        macship_tracking_url: macshipData.tracking_url || null,
        macship_pickup_date: macshipData.pickup_date || null,
        macship_quote_amount: macshipData.quote_amount || null,
        macship_governing_product_id: macshipData.governing_product_id || null,
        macship_consignment_failed: macshipData.failed || false,
        macship_lead_time_fallback: macshipData.used_fallback || false,
      }).eq("id", order.id).then(() => {})  // fire-and-forget
    }

    // Clear user's cart
    const { error: cartError } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", user.id)

    if (cartError) {
      console.error("Failed to clear cart after order creation:", cartError.message)
    }

    const customerName = userProfile?.contact_name || "Customer"
    const customerEmail = userProfile?.email || user.email || ""

    // Send order confirmation email to customer (non-blocking)
    if (payment_method === "purchase_order") {
      // PO orders are pending approval - send "under review" message instead of receipt
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
              <p>Thank you for your order. Our team is reviewing it and will approve it within 24 hours.</p>
              <p><strong>Order Number:</strong> ${order.order_number}</p>
              ${po_number ? `<p><strong>PO Number:</strong> ${po_number}</p>` : ""}
              <p>Once approved, you will receive an invoice and your order will be processed for delivery.</p>
              <p>If you have any questions, please don&apos;t hesitate to contact us.</p>
            `,
          },
        ],
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
          preheader: `Your order qualifies for ${bc.creditPercent}% store credit (AUD ${bc.creditAmount.toFixed(2)}).`,
          sections: [
            {
              title: "Congratulations!",
              content: `
                <p>Hi ${customerName},</p>
                <p>Your order <strong>#${order.order_number}</strong> qualifies for our <strong>${bc.promoName}</strong> promotion!</p>
                <p>You've earned <strong>${bc.creditPercent}% store credit</strong> worth <strong>AUD ${bc.creditAmount.toFixed(2)}</strong> on eligible products in this order.</p>
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
          `<li><strong>${bc.promoName}</strong>: ${bc.creditPercent}% credit on AUD ${bc.eligibleTotal.toFixed(2)} eligible products = <strong>AUD ${bc.creditAmount.toFixed(2)} credit</strong></li>`
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
                <p><strong>Order total:</strong> AUD ${total.toFixed(2)}</p>
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

    // --- Xero Integration (non-blocking) ---
    // PO orders: skip Xero invoice AND Xero PO here - they are created when admin approves.
    // Card orders: create Xero PO to warehouse only (no invoice needed for card payments).
    if (payment_method !== "purchase_order") {
      import("@/lib/xero/sync").then(({ createXeroPurchaseOrderForOrder }) => {
        createXeroPurchaseOrderForOrder(order.id)
          .then((result) => {
            if (result) {
              console.log(`[Xero] PO created for ${order.order_number}: ${result.poNumber}`)
            } else {
              console.warn(`[Xero] PO NOT created for ${order.order_number} - check /admin/xero (likely not connected, or warehouse missing xero_contact_id) or xero_sync_log table`)
            }
          })
          .catch((err) => {
            console.error("[Xero] PO creation failed (non-blocking):", err)
          })
      })
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
