"use client"

import { useRef, useEffect, type ReactNode } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

interface HorizontalScrollProps {
  children: ReactNode
  className?: string
}

export function HorizontalScroll({ children, className }: HorizontalScrollProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track) return

    // Calculate how far we need to scroll horizontally
    const getScrollDistance = () => {
      return track.scrollWidth - section.offsetWidth
    }

    const ctx = gsap.context(() => {
      const tween = gsap.to(track, {
        x: () => -getScrollDistance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top+=80",
          end: () => `+=${getScrollDistance()}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      return () => {
        tween.kill()
      }
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={sectionRef} className={className}>
      <div className="overflow-hidden">
        <div ref={trackRef} className="flex gap-6 will-change-transform">
          {children}
        </div>
      </div>
    </div>
  )
}
