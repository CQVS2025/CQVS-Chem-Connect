import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import {
  sendQuoteReceivedEmail,
  notifyAdminNewQuote,
} from "@/lib/email/notifications"

// GET /api/quotes - list quote requests
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { searchParams } = request.nextUrl
    const statusFilter = searchParams.get("status")

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const isAdmin = profile?.role === "admin"

    let query = supabase
      .from("quote_requests")
      .select("*")

    if (!isAdmin) {
      query = query.eq("user_id", user.id)
    }

    if (statusFilter && statusFilter !== "all") {
      query = query.eq("status", statusFilter)
    }

    query = query.order("created_at", { ascending: false })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error("GET /api/quotes error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/quotes - create a quote request
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      product_id,
      product_name,
      quantity,
      packaging_size,
      delivery_location,
      message,
      contact_name,
      contact_email,
      contact_phone,
      company_name,
    } = body

    if (!product_name || !contact_name || !contact_email) {
      return NextResponse.json(
        { error: "product_name, contact_name, and contact_email are required" },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from("quote_requests")
      .insert({
        user_id: user.id,
        product_id: product_id || null,
        product_name,
        quantity: quantity || 1,
        packaging_size: packaging_size || null,
        delivery_location: delivery_location || null,
        message: message || null,
        contact_name,
        contact_email,
        contact_phone: contact_phone || null,
        company_name: company_name || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send emails (non-blocking)
    sendQuoteReceivedEmail(contact_email, {
      customerName: contact_name,
      productName: product_name,
      quantity: quantity || 1,
      packagingSize: packaging_size,
    })

    notifyAdminNewQuote({
      customerName: contact_name,
      customerEmail: contact_email,
      customerPhone: contact_phone,
      companyName: company_name,
      productName: product_name,
      quantity: quantity || 1,
      packagingSize: packaging_size,
      deliveryLocation: delivery_location,
      message,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error("POST /api/quotes error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
