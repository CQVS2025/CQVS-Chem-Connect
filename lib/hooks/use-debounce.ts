"use client"

import { useEffect, useState } from "react"

/**
 * useDebounce — returns a value that updates only after `delayMs` has passed
 * without a change. Useful for search inputs to avoid firing a query on every
 * keystroke.
 */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
