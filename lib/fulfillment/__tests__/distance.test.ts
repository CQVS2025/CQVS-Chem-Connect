// Bracket-rounding behaviour. The plan locks "round up to next 100km" so
// 350 -> 400, 100 -> 100, 101 -> 200.

import { describe, it, expect } from "vitest"
import { roundUpToBracketKm } from "../distance"

describe("roundUpToBracketKm", () => {
  it.each([
    [0, 100],
    [1, 100],
    [50, 100],
    [100, 100],
    [101, 200],
    [350, 400],
    [400, 400],
    [401, 500],
    [3950, 4000],
  ])("rounds %ikm up to %ikm", (input, expected) => {
    expect(roundUpToBracketKm(input)).toBe(expected)
  })

  it("respects a custom step size", () => {
    expect(roundUpToBracketKm(125, 50)).toBe(150)
    expect(roundUpToBracketKm(50, 50)).toBe(50)
    expect(roundUpToBracketKm(51, 50)).toBe(100)
  })
})
