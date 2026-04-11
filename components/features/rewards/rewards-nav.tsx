"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "volume-tiers", label: "Tiers" },
  { id: "first-order", label: "First Order" },
  { id: "referrals", label: "Referrals" },
  { id: "bundles", label: "Bundles" },
  { id: "rebates", label: "Rebates" },
  { id: "seasonal", label: "Seasonal" },
  { id: "new-products", label: "New Products" },
  { id: "stamp-card", label: "Stamp Card" },
]

interface RewardsNavProps {
  activeSection: string
  onScrollTo: (id: string) => void
}

export function RewardsNav({ activeSection, onScrollTo }: RewardsNavProps) {
  const [isSticky, setIsSticky] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting)
      },
      { threshold: 1, rootMargin: "-80px 0px 0px 0px" }
    )

    observer.observe(nav)
    return () => observer.disconnect()
  }, [])

  // Auto-scroll active tab into view
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const activeTab = container.querySelector(`[data-tab="${activeSection}"]`)
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }
  }, [activeSection])

  return (
    <>
      <div ref={navRef} className="h-px" />
      <div
        className={cn(
          "sticky top-[72px] z-40 transition-all duration-300",
          isSticky
            ? "border-b border-border/60 bg-background/85 shadow-sm shadow-black/5 backdrop-blur-xl"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div
            ref={scrollRef}
            className="scrollbar-none flex gap-0.5 overflow-x-auto py-2.5"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => onScrollTo(tab.id)}
                className={cn(
                  "shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200",
                  activeSection === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
