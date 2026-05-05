// Variance threshold = max(quoted * pct/100, floor). Component 16 default
// is 10% or $100, whichever is greater.

import { describe, it, expect } from "vitest"
import { evaluateVariance } from "../variance"

describe("evaluateVariance", () => {
  it("flags when delta > both pct and floor", () => {
    const r = evaluateVariance(500, 700, 10, 100)
    // pct threshold = 50; floor = 100; effective = 100; delta = 200 > 100
    expect(r.flagged).toBe(true)
    expect(r.delta).toBe(200)
    expect(r.thresholdAbsolute).toBe(100)
  })

  it("respects the floor on small orders", () => {
    // pct threshold = $20; floor = $100; effective = $100. Delta $50 < $100.
    const r = evaluateVariance(200, 250, 10, 100)
    expect(r.flagged).toBe(false)
  })

  it("does not flag when delta is below threshold", () => {
    const r = evaluateVariance(2000, 2099, 10, 100)
    // pct threshold = $200; delta = $99
    expect(r.flagged).toBe(false)
  })

  it("flags large pct deltas on large orders", () => {
    const r = evaluateVariance(2000, 2400, 10, 100)
    // pct threshold = $200; delta = $400
    expect(r.flagged).toBe(true)
  })

  it("flags decreases the same way as increases", () => {
    const r = evaluateVariance(2000, 1500, 10, 100)
    expect(r.flagged).toBe(true)
    expect(r.delta).toBe(500)
  })

  it("returns a zero delta when figures match", () => {
    const r = evaluateVariance(500, 500, 10, 100)
    expect(r.delta).toBe(0)
    expect(r.flagged).toBe(false)
  })
})
