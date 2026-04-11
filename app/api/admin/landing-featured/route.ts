import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/supabase/admin-check"

const SECTION_LIMITS: Record<string, number> = {
  hero: 3,
  featured: 6,
}

interface LandingFeaturedRow {
  section: "hero" | "featured"
  position: number
  product_id: string
}

// GET /api/admin/landing-featured - public read of current selections
export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from("landing_featured")
    .select("section, position, product_id")
    .order("section", { ascending: true })
    .order("position", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as LandingFeaturedRow[]
  const hero = rows
    .filter((r) => r.section === "hero")
    .map((r) => r.product_id)
  const featured = rows
    .filter((r) => r.section === "featured")
    .map((r) => r.product_id)

  return NextResponse.json({ hero, featured })
}

// PUT /api/admin/landing-featured - replace selections for one or both sections
export async function PUT(request: NextRequest) {
  const { error: authError, supabase } = await requireAdmin()
  if (authError) return authError

  const body = (await request.json()) as {
    hero?: (string | null)[]
    featured?: (string | null)[]
  }

  const sectionsToUpdate: ("hero" | "featured")[] = []
  if (Array.isArray(body.hero)) sectionsToUpdate.push("hero")
  if (Array.isArray(body.featured)) sectionsToUpdate.push("featured")

  if (sectionsToUpdate.length === 0) {
    return NextResponse.json(
      { error: "No sections provided" },
      { status: 400 },
    )
  }

  for (const section of sectionsToUpdate) {
    const limit = SECTION_LIMITS[section]
    const ids = (body[section] ?? []).slice(0, limit)

    const { error: deleteError } = await supabase
      .from("landing_featured")
      .delete()
      .eq("section", section)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 },
      )
    }

    const rows = ids
      .map((id, idx) =>
        id ? { section, position: idx + 1, product_id: id } : null,
      )
      .filter((r): r is LandingFeaturedRow => r !== null)

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("landing_featured")
        .insert(rows)

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 },
        )
      }
    }
  }

  return NextResponse.json({ ok: true })
}
