// Parser tests — feed the parser the actual supplier matrix from the
// brief and confirm we extract the right brackets per column.

import { describe, it, expect } from "vitest"
import {
  parseFreightMatrix,
  buildSampleFreightMatrixCsv,
} from "../freight-matrix-csv"

describe("parseFreightMatrix", () => {
  it("parses the supplier-supplied tab-separated matrix correctly", () => {
    const input = `From (Km)\tTo (Km)\tBulk (Pre-13Jul25)\tBulk (Post 14Jul25)\tPack (Pre-13Jul25)\tPack Existing (Post-14Jul25)
4001\t4100\t\t\t\t
0\t100\t$0.067\t$0.070\t$60.00\t$63.00
101\t200\t$0.078\t$0.081\t$70.00\t$73.00`
    const r = parseFreightMatrix(input)
    expect(r.columns).toHaveLength(4)
    expect(r.rowCount).toBe(2) // 4001-4100 row has no rates so it's skipped at row level
    const bulkPost = r.columns.find((c) => c.header.includes("Post 14"))!
    expect(bulkPost.brackets).toEqual([
      { distance_from_km: 0, distance_to_km: 100, rate: 0.07 },
      { distance_from_km: 101, distance_to_km: 200, rate: 0.081 },
    ])
    expect(bulkPost.suggestedUnitType).toBe("per_litre")
    expect(bulkPost.suggestedIsActive).toBe(true)

    const packPre = r.columns.find((c) => c.header.includes("Pack (Pre"))!
    expect(packPre.suggestedUnitType).toBe("flat_per_consignment")
    expect(packPre.suggestedIsActive).toBe(false)
    expect(packPre.brackets).toEqual([
      { distance_from_km: 0, distance_to_km: 100, rate: 60 },
      { distance_from_km: 101, distance_to_km: 200, rate: 70 },
    ])
  })

  it("accepts comma-separated and from_km/to_km headers", () => {
    const input = `from_km,to_km,Bulk Post
0,100,0.07
101,200,0.081`
    const r = parseFreightMatrix(input)
    expect(r.columns).toHaveLength(1)
    expect(r.columns[0].brackets).toHaveLength(2)
  })

  it("skips rows where a rate cell is empty for that column only", () => {
    const input = `from_km,to_km,Col A,Col B
0,100,1.00,
101,200,,2.00`
    const r = parseFreightMatrix(input)
    expect(r.columns[0].brackets).toEqual([
      { distance_from_km: 0, distance_to_km: 100, rate: 1 },
    ])
    expect(r.columns[1].brackets).toEqual([
      { distance_from_km: 101, distance_to_km: 200, rate: 2 },
    ])
  })

  it("strips currency markers and thousands separators", () => {
    const input = `from_km,to_km,Col
0,100,"$1,234.56"`
    const r = parseFreightMatrix(input)
    expect(r.columns[0].brackets[0].rate).toBeCloseTo(1234.56, 2)
  })

  it("returns a clear error when from/to headers are missing", () => {
    const input = `something,else
1,2`
    const r = parseFreightMatrix(input)
    expect(r.columns).toHaveLength(0)
    expect(r.warnings.join(" ")).toMatch(/from_km|to_km/i)
  })

  it("warns and skips bad bracket ranges (to <= from)", () => {
    const input = `from_km,to_km,Col
200,100,1.00
0,100,2.00`
    const r = parseFreightMatrix(input)
    expect(r.warnings.some((w) => /skipped/.test(w))).toBe(true)
    expect(r.columns[0].brackets).toHaveLength(1)
  })
})

describe("buildSampleFreightMatrixCsv", () => {
  it("round-trips through the parser", () => {
    const csv = buildSampleFreightMatrixCsv()
    const r = parseFreightMatrix(csv)
    // 6 rate columns, 40 valid rows (the 4001-4100 marker has no rates)
    expect(r.columns).toHaveLength(6)
    expect(r.rowCount).toBe(40)
    const bulkPost = r.columns.find((c) => c.header.includes("Post-14"))!
    expect(bulkPost.brackets[0]).toEqual({
      distance_from_km: 0,
      distance_to_km: 100,
      rate: 0.07,
    })
  })
})
