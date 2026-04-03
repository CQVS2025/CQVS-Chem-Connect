/**
 * Promotion auto-apply detection utility.
 *
 * Checks active promotions against cart items and calculates discounts.
 * Promotions stack - multiple can apply simultaneously.
 *
 * Application order:
 *  1. Bundle discounts apply first
 *  2. Promotion discounts apply on remaining amounts
 *  3. First-order hook applies separately
 */

export interface PromotionForDetection {
  id: string
  name: string
  headline: string | null
  description: string | null
  discount_type: string
  discount_value: number
  promotion_type_detail: string | null
  min_order_value: number
  eligible_product_ids: string[] | null
  buy_quantity: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
}

export interface CartItemForPromo {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  shipping_fee: number
}

export interface QualifiedPromotion {
  promotionId: string
  promotionName: string
  headline: string | null
  discountType: string
  discountAmount: number
  freeFreight: boolean
  bonusCreditPercent: number
  label: string
}

/**
 * Detect which promotions qualify and calculate their discounts.
 */
export function detectActivePromotions(
  promotions: PromotionForDetection[],
  cartItems: CartItemForPromo[],
  subtotalAfterBundles: number
): QualifiedPromotion[] {
  const now = new Date()
  const results: QualifiedPromotion[] = []

  for (const promo of promotions) {
    if (!promo.is_active) continue

    // Check date range
    if (promo.start_date && new Date(promo.start_date) > now) continue
    if (promo.end_date) {
      const endDate = new Date(promo.end_date)
      endDate.setHours(23, 59, 59, 999)
      if (endDate < now) continue
    }

    // Check min order value against subtotal after bundle discounts
    if (promo.min_order_value > 0 && subtotalAfterBundles < promo.min_order_value) continue

    // Check eligible products
    const eligibleIds = promo.eligible_product_ids ?? []
    const hasEligibleFilter = eligibleIds.length > 0

    const eligibleItems = hasEligibleFilter
      ? cartItems.filter((item) => eligibleIds.includes(item.product_id))
      : cartItems

    // If eligible products are specified but none are in cart, skip
    if (hasEligibleFilter && eligibleItems.length === 0) continue

    // Calculate discount based on type
    let discountAmount = 0
    let freeFreight = false
    let bonusCreditPercent = 0
    let label = promo.headline || promo.name

    switch (promo.discount_type) {
      case "percentage": {
        const eligibleTotal = eligibleItems.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0
        )
        discountAmount = Math.round(eligibleTotal * (promo.discount_value / 100) * 100) / 100
        label = promo.headline || `${promo.name} (${promo.discount_value}% off)`
        break
      }

      case "fixed": {
        discountAmount = Math.min(promo.discount_value, subtotalAfterBundles)
        label = promo.headline || `${promo.name} ($${promo.discount_value} off)`
        break
      }

      case "free_freight": {
        freeFreight = true
        discountAmount = 0 // Shipping handled separately
        label = promo.headline || `${promo.name} (Free freight)`
        break
      }

      case "bonus_credit": {
        // Not deducted at checkout - just tracked
        bonusCreditPercent = promo.discount_value
        discountAmount = 0
        label = promo.headline || `${promo.name} (${promo.discount_value}% credit)`
        break
      }

      case "buy_x_get_y": {
        const buyQty = promo.buy_quantity || 3
        // Count total eligible items in cart
        const totalEligibleQty = eligibleItems.reduce((sum, item) => sum + item.quantity, 0)

        if (totalEligibleQty > buyQty) {
          // The items beyond buy_quantity get the discount
          const freeQty = totalEligibleQty - buyQty

          // Apply discount to the cheapest eligible items (most fair)
          const sortedByPrice = [...eligibleItems]
            .flatMap((item) =>
              Array.from({ length: item.quantity }, () => item.unit_price)
            )
            .sort((a, b) => a - b)

          const discountedPrices = sortedByPrice.slice(0, freeQty)
          discountAmount = Math.round(
            discountedPrices.reduce((sum, price) => sum + price * (promo.discount_value / 100), 0) * 100
          ) / 100

          label = promo.headline || promo.promotion_type_detail || promo.name
        }
        break
      }
    }

    if (discountAmount > 0 || freeFreight || bonusCreditPercent > 0) {
      results.push({
        promotionId: promo.id,
        promotionName: promo.name,
        headline: promo.headline,
        discountType: promo.discount_type,
        discountAmount,
        freeFreight,
        bonusCreditPercent,
        label,
      })
    }
  }

  return results
}

/**
 * Calculate total promotion discount amount (excluding free freight and bonus credit).
 */
export function calculatePromotionDiscount(qualifiedPromos: QualifiedPromotion[]): number {
  return qualifiedPromos.reduce((sum, p) => sum + p.discountAmount, 0)
}

/**
 * Check if any active promotion gives free freight.
 */
export function hasPromotionFreeFreight(qualifiedPromos: QualifiedPromotion[]): boolean {
  return qualifiedPromos.some((p) => p.freeFreight)
}
