import type { SupabaseClient } from "@supabase/supabase-js"

// Shared order-total + item-snapshot calculation used by both checkout paths:
//   - PO orders go straight from request body -> insert -> side effects.
//   - Card orders save the body to checkout_sessions first, then finalize
//     replays the same calculation after the PaymentIntent succeeds.
//
// Keeping the math in one place means the PaymentIntent amount at session
// creation and the final order total at finalize time are guaranteed to
// agree (modulo stable input data between the two calls).

const GST_RATE = 0.1
const STRIPE_FEE_PERCENT = 0.0175
const STRIPE_FEE_FIXED = 0.3
const STRIPE_FEE_GST = 0.1
const FREE_FREIGHT_CAP = 500
const TRUCK_WASH_SLUGS = ["truck-wash-standard", "truck-wash-premium"]

export interface CalculateOrderInput {
  payment_method: "stripe" | "purchase_order"
  items: Array<{
    product_id: string
    quantity: number
    packaging_size: string
    packaging_size_id?: string | null
    unit_price: number
  }>
  delivery_address_state?: string | null
  first_order_choice?: string | null
  first_order_truck_wash?: string | null
  macship_quote_amount?: number | null
}

export interface CalculatedOrder {
  subtotal: number
  shipping: number
  gst: number
  processing_fee: number
  container_total: number
  total: number
  bundle_discount: number
  first_order_discount: number
  first_order_free_freight: boolean
  first_order_choice: string | null
  promo_discount: number
  promo_free_freight: boolean
  applied_promo_names: string | null
  qualified_bonus_credits: Array<{
    promoName: string
    headline: string | null
    creditPercent: number
    eligibleTotal: number
    creditAmount: number
  }>
}

export interface OrderItemSnapshot {
  product_id: string
  product_name: string
  product_image_url: string | null
  unit: string
  quantity: number
  packaging_size: string
  packaging_size_id: string | null
  price_type: string | null
  unit_price: number
  total_price: number
  shipping_fee: number
  container_cost: number
}

interface ProductInfo {
  id: string
  name: string
  image_url: string | null
  unit: string
  shipping_fee?: number
  price: number
  price_type?: string
  classification?: string | null
}

interface WarehouseInfo {
  id: string
  address_state: string
  address_street: string
  address_city: string
  address_postcode: string
  name: string
  contact_phone: string | null
  contact_email: string | null
}

export type CalculateOrderResult =
  | {
      ok: true
      calculated: CalculatedOrder
      productMap: Map<string, ProductInfo>
      containerCostMap: Map<string, number>
      selectedWarehouse: WarehouseInfo | null
      orderItems: OrderItemSnapshot[]
    }
  | {
      ok: false
      error: string
      status: number
      moq?: number
    }

/** Replays the full order calculation against the current DB state.
 *  Safe to call twice for the same input: it's pure (no writes). */
export async function calculateOrder(
  supabase: SupabaseClient,
  userId: string,
  body: CalculateOrderInput,
): Promise<CalculateOrderResult> {
  const {
    payment_method,
    items,
    delivery_address_state,
    first_order_choice: firstOrderChoiceRaw,
    first_order_truck_wash: firstOrderTruckWash,
    macship_quote_amount,
  } = body

  if (!payment_method || !items || !Array.isArray(items) || items.length === 0) {
    return {
      ok: false,
      error: "payment_method and items are required",
      status: 400,
    }
  }

  if (!["stripe", "purchase_order"].includes(payment_method)) {
    return {
      ok: false,
      error: "payment_method must be 'stripe' or 'purchase_order'",
      status: 400,
    }
  }

  // MOQ validation against product_packaging_prices
  const itemsWithSize = items.filter((i) => i.packaging_size_id)
  if (itemsWithSize.length > 0) {
    const { data: moqRows } = await supabase
      .from("product_packaging_prices")
      .select("product_id, packaging_size_id, minimum_order_quantity")
      .in(
        "product_id",
        itemsWithSize.map((i) => i.product_id),
      )

    for (const item of itemsWithSize) {
      const row = moqRows?.find(
        (r: { product_id: string; packaging_size_id: string; minimum_order_quantity: number }) =>
          r.product_id === item.product_id &&
          r.packaging_size_id === item.packaging_size_id,
      )
      const moq = row?.minimum_order_quantity ?? 1
      if (item.quantity < moq) {
        return {
          ok: false,
          error: `Minimum order quantity for one or more items is not met (minimum: ${moq}).`,
          status: 400,
          moq,
        }
      }
    }
  }

  // Products snapshot (name/image/unit/shipping_fee) used for order_items.
  const productIds = items.map((i) => i.product_id)
  const { data: productsData } = await supabase
    .from("products")
    .select(
      "id, name, image_url, unit, shipping_fee, price, price_type, classification",
    )
    .in("id", productIds)

  const productMap = new Map<string, ProductInfo>(
    (productsData ?? []).map((p: ProductInfo) => [p.id, p]),
  )

  // Container costs per packaging size, scoped to the selected warehouse.
  const { data: allContainerCosts } = await supabase
    .from("container_costs")
    .select("warehouse_id, packaging_size_id, cost")

  const { data: warehousesData } = await supabase
    .from("warehouses")
    .select(
      "id, address_state, address_street, address_city, address_postcode, name, contact_phone, contact_email",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  const selectedWarehouse: WarehouseInfo | null =
    warehousesData?.find(
      (w: WarehouseInfo) => w.address_state === delivery_address_state,
    ) ?? warehousesData?.[0] ?? null

  const containerCostMap = new Map<string, number>()
  if (selectedWarehouse) {
    for (const cc of (allContainerCosts ?? []) as Array<{
      warehouse_id: string
      packaging_size_id: string
      cost: number | string
    }>) {
      if (cc.warehouse_id === selectedWarehouse.id) {
        containerCostMap.set(cc.packaging_size_id, Number(cc.cost) || 0)
      }
    }
  }

  let containerTotal = 0
  for (const item of items) {
    if (item.packaging_size_id) {
      const cost = containerCostMap.get(item.packaging_size_id) ?? 0
      containerTotal += cost * item.quantity
    }
  }
  containerTotal = Math.round(containerTotal * 100) / 100

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  )

  // Bundle discounts (highest-discount-first greedy claim).
  const { data: activeBundles } = await supabase
    .from("product_bundles")
    .select(
      "id, name, discount_percent, min_products, badge_text, is_active, bundle_products (product_id)",
    )
    .eq("is_active", true)

  let bundleDiscount = 0
  if (activeBundles && activeBundles.length > 0) {
    const uniqueProductIds = [...new Set(productIds)]
    const sortedBundles = [...activeBundles].sort(
      (a: { discount_percent: number }, b: { discount_percent: number }) =>
        b.discount_percent - a.discount_percent,
    )
    const claimed = new Set<string>()

    for (const bundle of sortedBundles as Array<{
      discount_percent: number
      min_products: number
      bundle_products: { product_id: string }[]
    }>) {
      const bundleProductIds =
        bundle.bundle_products?.map((bp) => bp.product_id) ?? []

      if (bundleProductIds.length > 0) {
        const matching = bundleProductIds.filter(
          (pid) => uniqueProductIds.includes(pid) && !claimed.has(pid),
        )
        if (matching.length >= bundle.min_products) {
          for (const pid of matching) {
            claimed.add(pid)
            const item = items.find((i) => i.product_id === pid)
            if (item) {
              bundleDiscount +=
                item.unit_price * item.quantity * (bundle.discount_percent / 100)
            }
          }
        }
      } else {
        const unclaimed = uniqueProductIds.filter((pid) => !claimed.has(pid))
        if (unclaimed.length >= bundle.min_products) {
          for (const pid of unclaimed) {
            claimed.add(pid)
            const item = items.find((i) => i.product_id === pid)
            if (item) {
              bundleDiscount +=
                item.unit_price * item.quantity * (bundle.discount_percent / 100)
            }
          }
        }
      }
    }
    bundleDiscount = Math.round(bundleDiscount * 100) / 100
  }

  // Live Machship quote wins; legacy per-product shipping_fee is only a
  // fallback for direct API callers that never quoted.
  const shippingMap = new Map(
    (productsData ?? []).map((p: { id: string; shipping_fee?: number }) => [
      p.id,
      p.shipping_fee ?? 0,
    ]),
  )
  const legacyShipping =
    Math.round(
      items.reduce(
        (sum, item) => sum + (shippingMap.get(item.product_id) ?? 0),
        0,
      ) * 100,
    ) / 100
  const shipping =
    typeof macship_quote_amount === "number" && macship_quote_amount > 0
      ? Math.round(macship_quote_amount * 100) / 100
      : legacyShipping

  // First-order incentives. Only applies to the user's very first order.
  let firstOrderDiscount = 0
  let firstOrderFreeFreight = false
  const firstOrderChoice = firstOrderChoiceRaw ?? null

  const { count: previousOrderCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)

  if ((previousOrderCount ?? 0) === 0 && firstOrderChoice) {
    if (firstOrderChoice === "free_freight") {
      firstOrderFreeFreight = true
    } else if (
      firstOrderChoice === "half_price_truck_wash" &&
      firstOrderTruckWash
    ) {
      const { data: selectedTW } = await supabase
        .from("products")
        .select("id")
        .eq("slug", firstOrderTruckWash)
        .maybeSingle()

      if (selectedTW) {
        const matchingItem = items.find((i) => i.product_id === selectedTW.id)
        if (matchingItem) {
          firstOrderDiscount =
            Math.round(
              matchingItem.unit_price * matchingItem.quantity * 0.5 * 100,
            ) / 100
        }
      }
    }
  }
  // Suppress unused-variable lint; the slug list is referenced by the
  // marketing team for promo config tests and may be imported elsewhere.
  void TRUCK_WASH_SLUGS

  // Active promotions. Computed against subtotal-after-bundles-and-first.
  let promoDiscount = 0
  let promoFreeFreight = false
  const qualifiedBonusCredits: CalculatedOrder["qualified_bonus_credits"] = []

  const { data: activePromos } = await supabase
    .from("promotions")
    .select("*")
    .eq("is_active", true)

  if (activePromos && activePromos.length > 0) {
    const now = new Date()
    const subtotalAfterBundlesAndFirst =
      subtotal - bundleDiscount - firstOrderDiscount

    for (const promo of activePromos as Array<{
      name: string
      headline: string | null
      start_date: string | null
      end_date: string | null
      min_order_value: number
      eligible_product_ids: string[] | null
      discount_type: string
      discount_value: number
      buy_quantity: number | null
    }>) {
      if (promo.start_date && new Date(promo.start_date) > now) continue
      if (promo.end_date) {
        const end = new Date(promo.end_date)
        end.setHours(23, 59, 59, 999)
        if (end < now) continue
      }

      if (
        promo.min_order_value > 0 &&
        subtotalAfterBundlesAndFirst < promo.min_order_value
      )
        continue

      const eligibleIds = promo.eligible_product_ids ?? []
      const hasFilter = eligibleIds.length > 0
      const eligibleItems = hasFilter
        ? items.filter((i) => eligibleIds.includes(i.product_id))
        : items

      if (hasFilter && eligibleItems.length === 0) continue

      switch (promo.discount_type) {
        case "percentage": {
          const eligibleTotal = eligibleItems.reduce(
            (s, i) => s + i.unit_price * i.quantity,
            0,
          )
          promoDiscount += eligibleTotal * (promo.discount_value / 100)
          break
        }
        case "fixed": {
          promoDiscount += Math.min(
            promo.discount_value,
            subtotalAfterBundlesAndFirst,
          )
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
            promoDiscount += discountedPrices.reduce(
              (s, p) => s + p * (promo.discount_value / 100),
              0,
            )
          }
          break
        }
        case "bonus_credit": {
          const eligibleTotal = eligibleItems.reduce(
            (s, i) => s + i.unit_price * i.quantity,
            0,
          )
          const creditAmount =
            Math.round(eligibleTotal * (promo.discount_value / 100) * 100) / 100
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

  // Names list used for the promo_names column on the order record.
  const appliedPromoNames =
    (activePromos as Array<{
      name: string
      headline: string | null
      is_active: boolean
      start_date: string | null
      end_date: string | null
      eligible_product_ids: string[] | null
    }> | null)
      ?.filter((p) => {
        const now = new Date()
        if (!p.is_active) return false
        if (p.start_date && new Date(p.start_date) > now) return false
        if (p.end_date) {
          const end = new Date(p.end_date)
          end.setHours(23, 59, 59, 999)
          if (end < now) return false
        }
        const eligibleIds = p.eligible_product_ids ?? []
        const hasFilter = eligibleIds.length > 0
        const eligibleItems = hasFilter
          ? items.filter((i) => eligibleIds.includes(i.product_id))
          : items
        if (hasFilter && eligibleItems.length === 0) return false
        return true
      })
      .map((p) => p.headline || p.name)
      .join(", ") || null

  // Free-freight waives the live quote but is capped at $500 - customer
  // pays the excess. Confirmed with Jonny, April 2026.
  const isFreeFreight = firstOrderFreeFreight || promoFreeFreight
  const effectiveShipping = isFreeFreight
    ? Math.max(0, Math.round((shipping - FREE_FREIGHT_CAP) * 100) / 100)
    : shipping
  const totalDiscount = bundleDiscount + firstOrderDiscount + promoDiscount
  const gst =
    Math.round(
      (subtotal - totalDiscount + containerTotal + effectiveShipping) *
        GST_RATE *
        100,
    ) / 100

  // Stripe's own fee flows through to the customer on card orders only.
  // PO orders don't pay a card fee.
  let processingFee = 0
  if (payment_method === "stripe") {
    const stripeFee =
      (subtotal - totalDiscount + containerTotal + effectiveShipping + gst) *
        STRIPE_FEE_PERCENT +
      STRIPE_FEE_FIXED
    const feeGst = stripeFee * STRIPE_FEE_GST
    processingFee = Math.round((stripeFee + feeGst) * 100) / 100
  }

  const total =
    Math.round(
      (subtotal -
        totalDiscount +
        containerTotal +
        effectiveShipping +
        gst +
        processingFee) *
        100,
    ) / 100

  // Per-item snapshot - frozen with the order so later product edits
  // don't mutate historical records.
  const orderItems: OrderItemSnapshot[] = items.map((item) => {
    const product = productMap.get(item.product_id)
    const containerCost = item.packaging_size_id
      ? containerCostMap.get(item.packaging_size_id) ?? 0
      : 0
    return {
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
  })

  return {
    ok: true,
    calculated: {
      subtotal,
      shipping: effectiveShipping,
      gst,
      processing_fee: processingFee,
      container_total: containerTotal,
      total,
      bundle_discount: bundleDiscount,
      first_order_discount: firstOrderDiscount,
      first_order_free_freight: firstOrderFreeFreight,
      first_order_choice: firstOrderChoice,
      promo_discount: promoDiscount,
      promo_free_freight: promoFreeFreight,
      applied_promo_names: appliedPromoNames,
      qualified_bonus_credits: qualifiedBonusCredits,
    },
    productMap,
    containerCostMap,
    selectedWarehouse,
    orderItems,
  }
}
