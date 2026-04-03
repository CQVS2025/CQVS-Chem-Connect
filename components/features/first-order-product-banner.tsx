"use client"

import Link from "next/link"
import { Gift, Truck, FlaskConical, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useOrders } from "@/lib/hooks/use-orders"
import { useRewards } from "@/lib/hooks/use-rewards"

const TRUCK_WASH_SLUGS = ["truck-wash-standard", "truck-wash-premium"]

interface FirstOrderProductBannerProps {
  productSlug: string
  productPrice: number
  productUnit: string
}

export function FirstOrderProductBanner({
  productSlug,
  productPrice,
  productUnit,
}: FirstOrderProductBannerProps) {
  const { data: orders } = useOrders()
  const { data: rewards } = useRewards()

  // Only show on truck wash product pages
  if (!TRUCK_WASH_SLUGS.includes(productSlug)) return null

  // Only show for first-time customers
  const hasOrders = orders && orders.length > 0
  const usedIncentive = rewards?.first_order_incentive_used
  if (hasOrders || usedIncentive) return null

  const discountedPrice = productPrice * 0.5

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Gift className="size-4 text-primary shrink-0" />
        <p className="text-sm font-bold">First Order Offer</p>
        <Badge className="ml-auto border-0 bg-primary text-primary-foreground text-[10px] font-bold">
          50% OFF
        </Badge>
      </div>

      {/* Two offers */}
      <div className="space-y-2">
        <div className="flex items-start gap-2.5 rounded-lg border border-violet-400/20 bg-violet-400/5 px-3 py-2.5">
          <FlaskConical className="size-4 text-violet-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold">Get this product at 50% off</p>
            <p className="text-[11px] text-muted-foreground">
              Add to cart and select &quot;50% Off Truck Wash&quot; at checkout.
              Pay only{" "}
              <span className="font-bold text-primary">
                ${discountedPrice.toFixed(2)}/{productUnit}
              </span>{" "}
              instead of ${productPrice.toFixed(2)}/{productUnit}.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-sky-400/20 bg-sky-400/5 px-3 py-2.5">
          <Truck className="size-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold">Or get free freight instead</p>
            <p className="text-[11px] text-muted-foreground">
              Select &quot;Free Freight&quot; at checkout to have all shipping fees waived on your first order.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="size-3 text-primary" />
        <p className="text-[10px] text-muted-foreground">
          First order only - choose one offer at{" "}
          <Link href="/cart" className="font-medium text-primary underline underline-offset-2">
            checkout
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
