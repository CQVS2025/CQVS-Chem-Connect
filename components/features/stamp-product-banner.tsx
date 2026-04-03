"use client"

import { Stamp } from "lucide-react"
import { useRewards } from "@/lib/hooks/use-rewards"
import { useOrders } from "@/lib/hooks/use-orders"

interface StampProductBannerProps {
  packagingSizes: string[]
}

export function StampProductBanner({ packagingSizes }: StampProductBannerProps) {
  const { data: rewards } = useRewards()
  const { data: orders } = useOrders()

  // Only show if product has 1000L IBC packaging
  const hasIBC = packagingSizes.some(
    (s) => s.toLowerCase().includes("1000") || s.toLowerCase().includes("ibc")
  )
  if (!hasIBC) return null

  const totalStamps = rewards?.total_stamps ?? 0
  const currentCard = totalStamps % 10
  const remaining = 10 - currentCard
  const hasOrders = orders && orders.length > 0

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
      <Stamp className="size-4 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold">Earns a loyalty stamp</p>
        <p className="text-[11px] text-muted-foreground">
          Order this product in 1000L IBC to earn 1 stamp.{" "}
          {hasOrders
            ? `You have ${currentCard}/10 stamps - ${remaining} more to a free IBC.`
            : "Collect 10 stamps for a free IBC of TW Standard, TW Premium, or Eco Wash."}
        </p>
      </div>
    </div>
  )
}
