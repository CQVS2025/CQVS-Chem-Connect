"use client"

import { domAnimation, LazyMotion, m } from "framer-motion"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(className)}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}
