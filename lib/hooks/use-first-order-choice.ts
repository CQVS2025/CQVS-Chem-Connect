"use client"

import { useState, useEffect, useCallback } from "react"
import type { FirstOrderChoice } from "@/components/features/first-order-offer"

const STORAGE_KEY_OPTION = "chem_first_order_choice"
const STORAGE_KEY_TW = "chem_first_order_tw"

function readSession(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSession(key: string, value: string | null) {
  if (typeof window === "undefined") return
  try {
    if (value === null) {
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, value)
    }
  } catch {
    // ignore
  }
}

export function useFirstOrderChoice() {
  const [option, setOptionRaw] = useState<FirstOrderChoice>(null)
  const [truckWash, setTruckWashRaw] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // Read from sessionStorage on mount
  useEffect(() => {
    const savedOption = readSession(STORAGE_KEY_OPTION) as FirstOrderChoice
    const savedTW = readSession(STORAGE_KEY_TW)
    if (savedOption) setOptionRaw(savedOption)
    if (savedTW) setTruckWashRaw(savedTW)
    setHydrated(true)
  }, [])

  const setOption = useCallback((value: FirstOrderChoice) => {
    setOptionRaw(value)
    writeSession(STORAGE_KEY_OPTION, value)
    if (value !== "half_price_truck_wash") {
      setTruckWashRaw(null)
      writeSession(STORAGE_KEY_TW, null)
    }
  }, [])

  const setTruckWash = useCallback((value: string | null) => {
    setTruckWashRaw(value)
    writeSession(STORAGE_KEY_TW, value)
  }, [])

  // Clear after order is placed
  const clear = useCallback(() => {
    setOptionRaw(null)
    setTruckWashRaw(null)
    writeSession(STORAGE_KEY_OPTION, null)
    writeSession(STORAGE_KEY_TW, null)
  }, [])

  return { option, truckWash, setOption, setTruckWash, clear, hydrated }
}
