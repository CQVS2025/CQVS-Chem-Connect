"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RewardsStatusHero } from "@/components/rewards/rewards-status-hero"
import { RewardsNav } from "@/components/features/rewards/rewards-nav"
import { VolumeTiers } from "@/components/features/rewards/volume-tiers"
import { FirstOrderHook } from "@/components/features/rewards/first-order-hook"
import { ReferralProgram } from "@/components/features/rewards/referral-program"
import { CrossSellBundles } from "@/components/features/rewards/cross-sell-bundles"
import { AnnualRebates } from "@/components/features/rewards/annual-rebates"
import { SeasonalPromotions } from "@/components/features/rewards/seasonal-promotions"
import { NewProductLaunch } from "@/components/features/rewards/new-product-launch"
import { StampCard } from "@/components/features/rewards/stamp-card"
import { StackRewards } from "@/components/features/rewards/stack-rewards"
import { RewardsCTA } from "@/components/features/rewards/rewards-cta"
import { useRewards } from "@/lib/hooks/use-rewards"

const sectionIds = [
  "volume-tiers",
  "first-order",
  "referrals",
  "bundles",
  "rebates",
  "seasonal",
  "new-products",
  "stamp-card",
]

export default function RewardsPage() {
  const [activeSection, setActiveSection] = useState(sectionIds[0])
  const observerRef = useRef<IntersectionObserver | null>(null)
  const { data: rewards } = useRewards()

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [])

  // Observe sections for active tab tracking
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => {
            const aRect = a.boundingClientRect
            const bRect = b.boundingClientRect
            return aRect.top - bRect.top
          })

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id)
        }
      },
      {
        rootMargin: "-120px 0px -60% 0px",
        threshold: 0,
      }
    )

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <div className="min-h-screen">
      {/* New: personalised status hero (logged-in) or value prop (logged-out) */}
      <RewardsStatusHero />

      {/* Sticky section nav - same as before */}
      <RewardsNav activeSection={activeSection} onScrollTo={scrollTo} />

      {/* ALL original sections preserved with full content */}
      <VolumeTiers userSpend={rewards?.current_month_spend ?? 0} />
      <FirstOrderHook />
      <ReferralProgram />
      <CrossSellBundles />
      <AnnualRebates annualSpend={rewards?.annual_spend ?? 0} />
      <SeasonalPromotions />
      <NewProductLaunch />
      <StampCard stamps={rewards?.total_stamps ?? 0} />

      <StackRewards />
      <RewardsCTA />
    </div>
  )
}
