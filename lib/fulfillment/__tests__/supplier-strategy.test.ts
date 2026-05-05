// Unit tests for the supplier-managed freight strategy.
//
// Mocks Supabase by stubbing the chained .from().select().in().eq()
// pattern. Each test seeds an in-memory rate sheet + brackets +
// product-mapping and checks the resulting freight number.

import { describe, it, expect, vi } from "vitest"
import { quoteSupplierManagedFreight } from "../supplier-strategy"
import type { FulfillmentWarehouse } from "../types"

// Tiny chainable mock that implements only the methods we use.
function buildMockSupabase(tables: Record<string, unknown[]>) {
  const make = (rows: unknown[]) => {
    const filters: Array<(r: Record<string, unknown>) => boolean> = []
    const obj: Record<string, unknown> = {
      select: vi.fn(() => obj),
      in: vi.fn((col: string, vals: unknown[]) => {
        filters.push((r) => vals.includes(r[col]))
        return obj
      }),
      eq: vi.fn((col: string, val: unknown) => {
        filters.push((r) => r[col] === val)
        return obj
      }),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => {
        const filtered = rows.filter((r) =>
          filters.every((f) => f(r as Record<string, unknown>)),
        )
        return Promise.resolve({ data: filtered, error: null }).then(resolve)
      },
    }
    return obj
  }
  return {
    from: vi.fn((table: string) => make(tables[table] ?? [])),
  } as unknown as Parameters<typeof quoteSupplierManagedFreight>[0]["supabase"]
}

const warehouse: FulfillmentWarehouse = {
  id: "wh-1",
  name: "Adblue HQ",
  address_street: "1 Tank Way",
  address_city: "Brisbane",
  address_state: "QLD",
  address_postcode: "4000",
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  is_supplier_managed: true,
}

describe("quoteSupplierManagedFreight", () => {
  it("computes per_litre × litres × distance bracket", async () => {
    const supabase = buildMockSupabase({
      product_freight_rate_sheets: [
        { product_id: "p-bulk", packaging_size_id: null, rate_sheet_id: "rs-1" },
      ],
      supplier_rate_sheets: [
        {
          id: "rs-1",
          warehouse_id: "wh-1",
          name: "AdBlue Bulk",
          unit_type: "per_litre",
          origin_postcode: "4000",
          is_active: true,
          min_charge: null,
          out_of_range_behavior: "last_bracket",
        },
      ],
      packaging_sizes: [{ id: "ps-bulk", volume_litres: 5000 }],
      supplier_rate_sheet_brackets: [
        { rate_sheet_id: "rs-1", distance_from_km: 0, distance_to_km: 100, rate: 0.12 },
        { rate_sheet_id: "rs-1", distance_from_km: 100, distance_to_km: 200, rate: 0.15 },
      ],
    })

    const result = await quoteSupplierManagedFreight({
      supabase,
      warehouse,
      cartLines: [
        { product_id: "p-bulk", packaging_size_id: "ps-bulk", quantity: 1 },
      ],
      destinationPostcode: "4000",
    })

    expect(result.blocker).toBeUndefined()
    // 0km bracket = first one, rate 0.12 × 5000L × 1 = 600
    expect(result.freightAmount).toBeCloseTo(600, 2)
    expect(result.supplierFreightBreakdown?.[0]?.rate_sheet_name).toBe("AdBlue Bulk")
  })

  it("applies min_charge floor", async () => {
    const supabase = buildMockSupabase({
      product_freight_rate_sheets: [
        { product_id: "p-pack", packaging_size_id: null, rate_sheet_id: "rs-2" },
      ],
      supplier_rate_sheets: [
        {
          id: "rs-2",
          warehouse_id: "wh-1",
          name: "AdBlue Pack",
          unit_type: "flat_per_consignment",
          origin_postcode: "4000",
          is_active: true,
          min_charge: 50,
          out_of_range_behavior: "last_bracket",
        },
      ],
      packaging_sizes: [],
      supplier_rate_sheet_brackets: [
        { rate_sheet_id: "rs-2", distance_from_km: 0, distance_to_km: 100, rate: 30 },
      ],
    })

    const result = await quoteSupplierManagedFreight({
      supabase,
      warehouse,
      cartLines: [{ product_id: "p-pack", quantity: 1 }],
      destinationPostcode: "4000",
    })

    // raw = 30, min_charge = 50 → 50
    expect(result.freightAmount).toBe(50)
  })

  it("returns out_of_range blocker when distance exceeds last bracket and behavior=block", async () => {
    const supabase = buildMockSupabase({
      product_freight_rate_sheets: [
        { product_id: "p-bulk", packaging_size_id: null, rate_sheet_id: "rs-3" },
      ],
      supplier_rate_sheets: [
        {
          id: "rs-3",
          warehouse_id: "wh-1",
          name: "Bounded sheet",
          unit_type: "per_litre",
          origin_postcode: "4000",
          is_active: true,
          min_charge: null,
          out_of_range_behavior: "block",
        },
      ],
      packaging_sizes: [{ id: "ps", volume_litres: 100 }],
      supplier_rate_sheet_brackets: [
        { rate_sheet_id: "rs-3", distance_from_km: 0, distance_to_km: 100, rate: 0.1 },
      ],
    })

    // Force a long distance by using a postcode the haversine fallback
    // doesn't know about (returns null) — but we can use a known distant
    // pair. 4000 → 6000 (Brisbane → Perth) ≈ 4000+km.
    const result = await quoteSupplierManagedFreight({
      supabase,
      warehouse,
      cartLines: [{ product_id: "p-bulk", packaging_size_id: "ps", quantity: 1 }],
      destinationPostcode: "6000",
    })

    expect(result.blocker?.code).toBe("out_of_range")
  })

  it("blocks when no rate sheet maps to the cart line", async () => {
    const supabase = buildMockSupabase({
      product_freight_rate_sheets: [],
      supplier_rate_sheets: [],
      packaging_sizes: [],
      supplier_rate_sheet_brackets: [],
    })

    const result = await quoteSupplierManagedFreight({
      supabase,
      warehouse,
      cartLines: [{ product_id: "p-unknown", quantity: 1 }],
      destinationPostcode: "4000",
    })

    expect(result.blocker?.code).toBe("no_rate_sheet")
  })
})
