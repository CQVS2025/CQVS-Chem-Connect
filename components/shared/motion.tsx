"use client"

import { type ReactNode, useRef } from "react"
import {
  domAnimation,
  LazyMotion,
  m,
  useInView,
  type Variants,
} from "framer-motion"

import { cn } from "@/lib/utils"

// Shared transition presets
const springSmooth = { type: "spring" as const, stiffness: 100, damping: 20 }
const easeOut = { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }

// --- FadeIn ---
interface FadeInProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  direction?: "up" | "down" | "left" | "right" | "none"
  distance?: number
  once?: boolean
  threshold?: number
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  direction = "up",
  distance = 24,
  once = true,
  threshold = 0.15,
}: FadeInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, amount: threshold })

  const directionMap = {
    up: { y: distance },
    down: { y: -distance },
    left: { x: distance },
    right: { x: -distance },
    none: {},
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        ref={ref}
        initial={{ opacity: 0, ...directionMap[direction] }}
        animate={
          isInView
            ? { opacity: 1, x: 0, y: 0 }
            : { opacity: 0, ...directionMap[direction] }
        }
        transition={{ duration, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={cn(className)}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}

// --- StaggerContainer + StaggerItem ---
interface StaggerContainerProps {
  children: ReactNode
  className?: string
  staggerDelay?: number
  once?: boolean
  threshold?: number
}

const containerVariants = (staggerDelay: number): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: staggerDelay,
    },
  },
})

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: easeOut,
  },
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.08,
  once = true,
  threshold = 0.1,
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, amount: threshold })

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        ref={ref}
        variants={containerVariants(staggerDelay)}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className={cn(className)}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div variants={itemVariants} className={cn(className)}>
        {children}
      </m.div>
    </LazyMotion>
  )
}

// --- ScaleIn (for cards, badges) ---
interface ScaleInProps {
  children: ReactNode
  className?: string
  delay?: number
  once?: boolean
}

export function ScaleIn({
  children,
  className,
  delay = 0,
  once = true,
}: ScaleInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, amount: 0.15 })

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={
          isInView
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 0.92 }
        }
        transition={{ ...springSmooth, delay }}
        className={cn(className)}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}

// --- HoverCard (lift + glow on hover) ---
interface HoverCardProps {
  children: ReactNode
  className?: string
}

export function HoverCard({ children, className }: HoverCardProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        whileHover={{ y: -4, transition: { duration: 0.2 } }}
        className={cn(className)}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}

// --- AnimatedCounter ---
interface AnimatedCounterProps {
  value: string
  className?: string
}

export function AnimatedCounter({ value, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true })

  return (
    <LazyMotion features={domAnimation} strict>
      <m.span
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.4 }}
        className={cn(className)}
      >
        {value}
      </m.span>
    </LazyMotion>
  )
}

// --- BlurIn (text reveal) ---
interface BlurInProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function BlurIn({ children, className, delay = 0 }: BlurInProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        ref={ref}
        initial={{ opacity: 0, filter: "blur(8px)" }}
        animate={
          isInView
            ? { opacity: 1, filter: "blur(0px)" }
            : { opacity: 0, filter: "blur(8px)" }
        }
        transition={{ duration: 0.6, delay }}
        className={cn(className)}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}

// --- FloatingElement (subtle floating animation) ---
interface FloatingElementProps {
  children: ReactNode
  className?: string
  duration?: number
  distance?: number
}

export function FloatingElement({
  children,
  className,
  duration = 3,
  distance = 8,
}: FloatingElementProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        animate={{ y: [-distance, distance, -distance] }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={cn(className)}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}
