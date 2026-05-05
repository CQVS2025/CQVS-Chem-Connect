// GET /api/admin/supplier-fulfillment/reconciliation
//
// Per-order reconciliation read for supplier-managed orders. Joins:
//   - order subtotal (sale price)         from orders.subtotal
//   - product cost                        from warehouse_product_pricing
//                                         (per warehouse + product + size)
//   - buyer-paid shipping                 from orders.shipping
//   - supplier freight cost               from orders.supplier_freight_cost
//
// Full margin = subtotal − sum(product cost × qty) − supplier_freight_cost
//
// (Component 15 — replaces the original "freight margin only" view per
// Jonny's round-2 clarification.)

import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

export async function GET(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const supplierId = request.nextUrl.searchParams.get("warehouse_id")
  const start = request.nextUrl.searchParams.get("from")
  const end = request.nextUrl.searchParams.get("to")
  const billing = request.nextUrl.searchParams.get("billing") // "pending" | "done" | null

  // Pull all supplier-managed warehouses (for filtering).
  const { data: supplierWarehouses } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("is_supplier_managed", true)
  const supplierWhIds = (supplierWarehouses ?? []).map(
    (w: { id: string }) => w.id,
  )
  if (supplierWhIds.length === 0) {
    return NextResponse.json({ rows: [], totals: zeroTotals() })
  }

  let q = supabase
    .from("orders")
    .select(
      `id, order_number, created_at, warehouse_id, total, subtotal, shipping,
       supplier_freight_cost, xero_po_number, status, xero_po_billed_at,
       order_items (product_id, packaging_size_id, quantity, unit_price, total_price)`,
    )
    .in("warehouse_id", supplierId ? [supplierId] : supplierWhIds)
    .order("created_at", { ascending: false })

  if (start) q = q.gte("created_at", start)
  if (end) q = q.lte("created_at", end)

  const { data: orders, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Pull cost prices in one go.
  const allLineKeys: Array<{
    warehouse_id: string
    product_id: string
    packaging_size_id: string
  }> = []
  for (const o of orders ?? []) {
    for (const it of o.order_items ?? []) {
      if (it.packaging_size_id) {
        allLineKeys.push({
          warehouse_id: o.warehouse_id,
          product_id: it.product_id,
          packaging_size_id: it.packaging_size_id,
        })
      }
    }
  }
  const productIds = [...new Set(allLineKeys.map((k) => k.product_id))]
  const { data: pricing } = await supabase
    .from("warehouse_product_pricing")
    .select("warehouse_id, product_id, packaging_size_id, cost_price")
    .in("product_id", productIds.length > 0 ? productIds : ["00000000-0000-0000-0000-000000000000"])

  const costMap = new Map<string, number>()
  for (const r of pricing ?? []) {
    const p = r as {
      warehouse_id: string
      product_id: string
      packaging_size_id: string
      cost_price: number
    }
    costMap.set(
      `${p.warehouse_id}::${p.product_id}::${p.packaging_size_id}`,
      Number(p.cost_price) || 0,
    )
  }

  // Pull approved variance claims for these orders so the reconciliation
  // view can show admin the exact freight amount to enter on the Xero Bill
  // when "Mark as billed" is clicked.
  const orderIds = (orders ?? []).map((o: { id: string }) => o.id)
  const { data: claims } = await supabase
    .from("freight_variance_claims")
    .select("order_id, claimed_amount, status, decision_note, reviewed_at")
    .in("order_id", orderIds.length > 0 ? orderIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false })

  const approvedClaimByOrder = new Map<
    string,
    { amount: number; reviewed_at: string | null; note: string | null }
  >()
  for (const c of claims ?? []) {
    const cc = c as {
      order_id: string
      claimed_amount: number
      reviewed_at: string | null
      decision_note: string | null
    }
    if (!approvedClaimByOrder.has(cc.order_id)) {
      approvedClaimByOrder.set(cc.order_id, {
        amount: Number(cc.claimed_amount),
        reviewed_at: cc.reviewed_at,
        note: cc.decision_note,
      })
    }
  }

  const rows = (orders ?? []).map((o) => {
    let productCost = 0
    for (const it of o.order_items ?? []) {
      if (it.packaging_size_id) {
        const c =
          costMap.get(
            `${o.warehouse_id}::${it.product_id}::${it.packaging_size_id}`,
          ) ?? 0
        productCost += c * it.quantity
      }
    }
    const supplierFreight = Number(o.supplier_freight_cost) || 0
    const buyerShipping = Number(o.shipping) || 0
    const subtotal = Number(o.subtotal) || 0
    const fullMargin = subtotal - productCost - supplierFreight
    const freightMargin = buyerShipping - supplierFreight

    // Bill instruction: what admin should enter as the freight line on the
    // Xero Bill when converting the PO. Falls back to PO freight when no
    // approved claim exists.
    const claim = approvedClaimByOrder.get(o.id) ?? null
    const billFreight = claim ? claim.amount : buyerShipping
    const billedAt = (o as { xero_po_billed_at?: string | null })
      .xero_po_billed_at ?? null
    const billAdjustmentNeeded =
      claim != null &&
      Math.abs(claim.amount - buyerShipping) > 0.005 &&
      !billedAt

    return {
      id: o.id,
      order_number: o.order_number,
      created_at: o.created_at,
      warehouse_id: o.warehouse_id,
      status: o.status,
      xero_po_number: o.xero_po_number ?? null,
      subtotal,
      buyer_shipping: buyerShipping,
      product_cost: Math.round(productCost * 100) / 100,
      supplier_freight: supplierFreight,
      freight_margin: Math.round(freightMargin * 100) / 100,
      full_margin: Math.round(fullMargin * 100) / 100,
      approved_claim_amount: claim?.amount ?? null,
      approved_claim_note: claim?.note ?? null,
      bill_freight: Math.round(billFreight * 100) / 100,
      bill_adjustment_needed: billAdjustmentNeeded,
      xero_po_billed_at: billedAt,
    }
  })

  // Optional billing-status filter (applied post-shape so totals reflect
  // the filtered subset).
  const filteredRows =
    billing === "pending"
      ? rows.filter(
          (r) => r.approved_claim_amount !== null && !r.xero_po_billed_at,
        )
      : billing === "done"
        ? rows.filter((r) => r.xero_po_billed_at !== null)
        : rows

  const totals = filteredRows.reduce(
    (acc, r) => ({
      subtotal: acc.subtotal + r.subtotal,
      buyer_shipping: acc.buyer_shipping + r.buyer_shipping,
      product_cost: acc.product_cost + r.product_cost,
      supplier_freight: acc.supplier_freight + r.supplier_freight,
      freight_margin: acc.freight_margin + r.freight_margin,
      full_margin: acc.full_margin + r.full_margin,
    }),
    zeroTotals(),
  )

  // Counts for the tab badges in the UI (always computed from the unfiltered
  // result so admin always sees how many are pending vs done overall).
  const pendingCount = rows.filter(
    (r) => r.approved_claim_amount !== null && !r.xero_po_billed_at,
  ).length
  const doneCount = rows.filter((r) => r.xero_po_billed_at !== null).length

  return NextResponse.json({
    rows: filteredRows,
    totals,
    supplier_warehouses: supplierWarehouses,
    counts: { all: rows.length, pending: pendingCount, done: doneCount },
  })
}

function zeroTotals() {
  return {
    subtotal: 0,
    buyer_shipping: 0,
    product_cost: 0,
    supplier_freight: 0,
    freight_margin: 0,
    full_margin: 0,
  }
}
