/**
 * Bundle detection utility.
 *
 * Given a list of active bundles and the product IDs in a cart,
 * determines which bundles qualify and calculates per-item discounts.
 *
 * Rules:
 *  - A bundle qualifies when the cart contains >= bundle.min_products
 *    distinct products from that bundle's product list.
 *  - If a bundle has NO linked products (generic "any N+ products" bundle),
 *    it qualifies when the cart contains >= min_products distinct products total.
 *  - A product can only belong to ONE qualifying bundle (the one giving the
 *    highest discount wins).
 *  - Discount applies to the unit_price of each qualifying item.
 */

export interface BundleForDetection {
  id: string
  name: string
  discount_percent: number
  min_products: number
  badge_text: string | null
  is_active: boolean
  bundle_products?: { product_id: string }[]
}

export interface QualifiedBundle {
  bundleId: string
  bundleName: string
  discountPercent: number
  badgeText: string | null
  /** product IDs that receive this bundle's discount */
  qualifyingProductIds: string[]
}

export interface ItemDiscount {
  productId: string
  bundleId: string
  bundleName: string
  discountPercent: number
}

/**
 * Detect which bundles qualify given the cart's distinct product IDs.
 */
export function detectQualifiedBundles(
  bundles: BundleForDetection[],
  cartProductIds: string[]
): QualifiedBundle[] {
  const uniqueCartIds = [...new Set(cartProductIds)]
  const qualified: QualifiedBundle[] = []

  // Sort bundles by discount descending so highest discount gets first pick
  const sorted = [...bundles]
    .filter((b) => b.is_active)
    .sort((a, b) => b.discount_percent - a.discount_percent)

  const claimedProducts = new Set<string>()

  for (const bundle of sorted) {
    const bundleProductIds = bundle.bundle_products?.map((bp) => bp.product_id) ?? []

    if (bundleProductIds.length > 0) {
      // Specific-product bundle: check how many of its products are in cart (unclaimed)
      const matching = bundleProductIds.filter(
        (pid) => uniqueCartIds.includes(pid) && !claimedProducts.has(pid)
      )

      if (matching.length >= bundle.min_products) {
        qualified.push({
          bundleId: bundle.id,
          bundleName: bundle.name,
          discountPercent: bundle.discount_percent,
          badgeText: bundle.badge_text,
          qualifyingProductIds: matching,
        })
        matching.forEach((pid) => claimedProducts.add(pid))
      }
    } else {
      // Generic bundle (no specific products): check total unclaimed distinct products
      const unclaimed = uniqueCartIds.filter((pid) => !claimedProducts.has(pid))

      if (unclaimed.length >= bundle.min_products) {
        qualified.push({
          bundleId: bundle.id,
          bundleName: bundle.name,
          discountPercent: bundle.discount_percent,
          badgeText: bundle.badge_text,
          qualifyingProductIds: unclaimed,
        })
        unclaimed.forEach((pid) => claimedProducts.add(pid))
      }
    }
  }

  return qualified
}

/**
 * Build a map of productId -> discount info for easy lookup.
 */
export function buildItemDiscountMap(
  qualifiedBundles: QualifiedBundle[]
): Map<string, ItemDiscount> {
  const map = new Map<string, ItemDiscount>()

  for (const qb of qualifiedBundles) {
    for (const pid of qb.qualifyingProductIds) {
      if (!map.has(pid)) {
        map.set(pid, {
          productId: pid,
          bundleId: qb.bundleId,
          bundleName: qb.bundleName,
          discountPercent: qb.discountPercent,
        })
      }
    }
  }

  return map
}

/**
 * Calculate the total bundle discount amount for a cart.
 */
export function calculateBundleDiscount(
  discountMap: Map<string, ItemDiscount>,
  cartItems: { product_id: string; quantity: number; unit_price: number }[]
): number {
  let totalDiscount = 0

  for (const item of cartItems) {
    const discount = discountMap.get(item.product_id)
    if (discount) {
      totalDiscount += item.unit_price * item.quantity * (discount.discountPercent / 100)
    }
  }

  return Math.round(totalDiscount * 100) / 100
}
