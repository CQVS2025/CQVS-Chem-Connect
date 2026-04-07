import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createXeroInvoiceForOrder } from "@/lib/xero/sync"

// GET /api/orders/[id]/documents - list documents for an order
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("order_documents")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Generate signed URLs for private bucket
    const withUrls = await Promise.all(
      (data ?? []).map(async (doc) => {
        // Extract path from the stored URL or use it directly
        const path = doc.file_url.includes("/object/")
          ? doc.file_url.split("/object/sign/order-documents/").pop() ||
            doc.file_url.split("/object/public/order-documents/").pop() ||
            doc.file_url
          : doc.file_url

        const { data: downloadData } = await supabase.storage
          .from("order-documents")
          .createSignedUrl(path, 3600, { download: doc.file_name })

        const { data: viewData } = await supabase.storage
          .from("order-documents")
          .createSignedUrl(path, 3600)

        return {
          ...doc,
          signed_url: downloadData?.signedUrl || doc.file_url,
          view_url: viewData?.signedUrl || doc.file_url,
        }
      }),
    )

    return NextResponse.json(withUrls)
  } catch (err) {
    console.error("GET /api/orders/[id]/documents error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/orders/[id]/documents - upload documents
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify order belongs to user
    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, payment_method, xero_invoice_id")
      .eq("id", id)
      .single()

    if (!order || order.user_id !== user.id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]

    const uploaded = []

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) continue
      if (file.size > 10 * 1024 * 1024) continue

      const ext = file.name.split(".").pop()
      const fileName = `${crypto.randomUUID()}.${ext}`
      const filePath = `orders/${id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("order-documents")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) continue

      const { data: doc, error: insertError } = await supabase
        .from("order_documents")
        .insert({
          order_id: id,
          file_name: file.name,
          file_url: filePath,
          file_size: file.size,
          file_type: file.type,
        })
        .select()
        .single()

      if (!insertError && doc) {
        uploaded.push(doc)
      }
    }

    // Trigger Xero invoice creation now that docs are uploaded.
    // Only fires for PO orders that haven't already been synced.
    // Fire-and-forget so the upload response stays fast.
    if (
      order.payment_method === "purchase_order" &&
      !order.xero_invoice_id &&
      uploaded.length > 0
    ) {
      createXeroInvoiceForOrder(id).catch((err) => {
        console.error("Xero invoice auto-create failed:", err)
      })
    }

    return NextResponse.json(uploaded, { status: 201 })
  } catch (err) {
    console.error("POST /api/orders/[id]/documents error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
