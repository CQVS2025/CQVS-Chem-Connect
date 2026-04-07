/**
 * Pricing calculation utilities for the new packaging-size pricing model.
 *
 * Two pricing types are supported:
 *  - per_litre: line total = price_per_litre * volume_litres * quantity
 *  - fixed:     line total = fixed_price * quantity
 */

import type {
  PackagingSize,
  ProductPackagingPrice,
  ProductPriceType,
} from "@/lib/supabase/types"

export interface LinePriceInput {
  priceType: ProductPriceType
  packagingPrice: Pick<ProductPackagingPrice, "price_per_litre" | "fixed_price">
  packagingSize: Pick<PackagingSize, "volume_litres">
  quantity: number
}

export interface LinePriceResult {
  unitPrice: number
  lineTotal: number
}

/**
 * Resolve unit price + line total for a given product packaging selection.
 * Rounds to 2dp at the line level.
 */
export function calculateLinePrice(input: LinePriceInput): LinePriceResult {
  const { priceType, packagingPrice, packagingSize, quantity } = input
  const qty = Math.max(1, Number(quantity) || 1)

  if (priceType === "per_litre") {
    const perLitre = Number(packagingPrice.price_per_litre ?? 0)
    const litres = Number(packagingSize.volume_litres ?? 0)
    const unitPrice = round2(perLitre * litres)
    return {
      unitPrice,
      lineTotal: round2(unitPrice * qty),
    }
  }

  const fixed = Number(packagingPrice.fixed_price ?? 0)
  return {
    unitPrice: round2(fixed),
    lineTotal: round2(fixed * qty),
  }
}

/**
 * Resolve unit price for a single packaging selection (no quantity).
 * Used for displaying option-level pricing on the product page.
 */
export function calculateUnitPrice(
  priceType: ProductPriceType,
  packagingPrice: Pick<ProductPackagingPrice, "price_per_litre" | "fixed_price">,
  packagingSize: Pick<PackagingSize, "volume_litres">,
): number {
  if (priceType === "per_litre") {
    const perLitre = Number(packagingPrice.price_per_litre ?? 0)
    const litres = Number(packagingSize.volume_litres ?? 0)
    return round2(perLitre * litres)
  }
  return round2(Number(packagingPrice.fixed_price ?? 0))
}

/**
 * Returns the per-item container cost for a packaging size at a specific
 * warehouse. Returns 0 if no container cost is configured.
 */
export function getContainerCost(
  containerCosts: Array<{
    warehouse_id: string
    packaging_size_id: string
    cost: number
  }>,
  warehouseId: string | null | undefined,
  packagingSizeId: string,
): number {
  if (!warehouseId) return 0
  const match = containerCosts.find(
    (c) =>
      c.warehouse_id === warehouseId && c.packaging_size_id === packagingSizeId,
  )
  return match ? round2(Number(match.cost) || 0) : 0
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100
}

/**
 * Format a price for display in AUD.
 */
export function formatPrice(n: number): string {
  return `$${round2(n).toFixed(2)}`
}
