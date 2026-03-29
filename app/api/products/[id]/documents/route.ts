import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

// GET /api/products/[id]/documents - list SDS documents for a product
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

    // Use service role to list documents (bypasses RLS so unauthenticated users can see names)
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data, error } = await adminSupabase
      .from("product_documents")
      .select("*")
      .eq("product_id", id)
      .order("created_at", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If user is authenticated, generate signed download URLs
    if (user) {
      const withUrls = await Promise.all(
        (data ?? []).map(async (doc) => {
          const { data: signedData } = await supabase.storage
            .from("product-documents")
            .createSignedUrl(doc.file_url, 3600, { download: doc.file_name })

          const { data: viewData } = await supabase.storage
            .from("product-documents")
            .createSignedUrl(doc.file_url, 3600)

          return {
            ...doc,
            download_url: signedData?.signedUrl || null,
            view_url: viewData?.signedUrl || null,
          }
        }),
      )
      return NextResponse.json(withUrls)
    }

    // Not authenticated - return doc info without URLs
    return NextResponse.json(
      (data ?? []).map((doc) => ({
        ...doc,
        download_url: null,
        view_url: null,
      })),
    )
  } catch (err) {
    console.error("GET /api/products/[id]/documents error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/products/[id]/documents - upload SDS document (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    const docType = (formData.get("doc_type") as string) || "sds"

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const uploaded = []

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) continue

      const ext = file.name.split(".").pop()
      const fileName = `${crypto.randomUUID()}.${ext}`
      const filePath = `products/${id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("product-documents")
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) continue

      const { data: doc, error: insertError } = await supabase
        .from("product_documents")
        .insert({
          product_id: id,
          file_name: file.name,
          file_url: filePath,
          file_size: file.size,
          file_type: file.type,
          doc_type: docType,
        })
        .select()
        .single()

      if (!insertError && doc) {
        uploaded.push(doc)
      }
    }

    return NextResponse.json(uploaded, { status: 201 })
  } catch (err) {
    console.error("POST /api/products/[id]/documents error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/products/[id]/documents - delete a document (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error: adminError, supabase } = await requireAdmin()
    if (adminError) return adminError

    const { document_id } = await request.json()

    if (!document_id) {
      return NextResponse.json({ error: "document_id is required" }, { status: 400 })
    }

    // Get file path to delete from storage
    const { data: doc } = await supabase
      .from("product_documents")
      .select("file_url")
      .eq("id", document_id)
      .single()

    if (doc) {
      await supabase.storage.from("product-documents").remove([doc.file_url])
    }

    await supabase.from("product_documents").delete().eq("id", document_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/products/[id]/documents error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
