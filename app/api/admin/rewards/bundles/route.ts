import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { createServerSupabaseClient } from "@/lib/supabase/server"

// Public GET - anyone can see bundles
export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data: bundles, error } = await supabase
    .from("product_bundles")
    .select(`
      *,
      bundle_products (
        id,
        product_id,
        product:products (
          id, name, slug, price, unit
        )
      )
    `)
    .order("sort_order")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(bundles)
}

export async function POST(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { name, discount_percent, min_products, description, badge_text, product_ids } = body

  if (!name || discount_percent === undefined) {
    return NextResponse.json(
      { error: "name and discount_percent are required" },
      { status: 400 }
    )
  }

  const { data, error: insertError } = await supabase
    .from("product_bundles")
    .insert({
      name,
      discount_percent,
      min_products: min_products || 3,
      description: description || "",
      badge_text: badge_text || `${discount_percent}% OFF`,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Link products if provided
  if (Array.isArray(product_ids) && product_ids.length > 0) {
    const rows = product_ids.map((pid: string) => ({
      bundle_id: data.id,
      product_id: pid,
    }))
    await supabase.from("bundle_products").insert(rows)
  }

  return NextResponse.json(data, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const { error, supabase } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { id, product_ids, ...updates } = body

  if (!id) {
    return NextResponse.json({ error: "Bundle ID required" }, { status: 400 })
  }

  // If product_ids is provided, sync the bundle_products join table
  if (Array.isArray(product_ids)) {
    // Delete existing bundle products
    await supabase
      .from("bundle_products")
      .delete()
      .eq("bundle_id", id)

    // Insert new ones
    if (product_ids.length > 0) {
      const rows = product_ids.map((pid: string) => ({
        bundle_id: id,
        product_id: pid,
      }))
      const { error: linkError } = await supabase
        .from("bundle_products")
        .insert(rows)

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 })
      }
    }
  }

  // Update bundle metadata if any fields provided
  const metaUpdates = Object.keys(updates).length > 0 ? updates : null
  if (metaUpdates) {
    const { error: updateError } = await supabase
      .from("product_bundles")
      .update(metaUpdates)
      .eq("id", id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  // Return the updated bundle with products
  const { data: updated, error: fetchError } = await supabase
    .from("product_bundles")
    .select(`
      *,
      bundle_products (
        id,
        product_id,
        product:products (
          id, name, slug, price, unit
        )
      )
    `)
    .eq("id", id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
