import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { syncProfileToXero } from "@/lib/xero/sync"

// POST /api/xero/contacts/sync - sync a profile to Xero as a Contact
//
// Called from:
//  - Signup page (fire-and-forget for new customers)
//  - Admin panel (for backfilling existing customers)
//
// Body: { profile_id: string }
//
// Customers can only trigger sync for themselves; admins can sync any profile.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const profileId = (body.profile_id as string) || user.id

    // Authorization: must be self or admin
    if (profileId !== user.id) {
      const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (requesterProfile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const xeroContactId = await syncProfileToXero(profileId)

    if (!xeroContactId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Sync failed - check Xero connection and the sync log for details.",
        },
        { status: 200 },
      )
    }

    return NextResponse.json({ ok: true, xero_contact_id: xeroContactId })
  } catch (err) {
    console.error("POST /api/xero/contacts/sync error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
