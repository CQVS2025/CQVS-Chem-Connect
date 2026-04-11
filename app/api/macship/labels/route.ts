import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { getLabelsUrl, getMachshipToken, isMacShipConfigured } from "@/lib/macship/client"

// GET /api/macship/labels?consignment_id=XXX
// Proxies the Machship label PDF to the browser (admin-only).
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const consignmentId = request.nextUrl.searchParams.get("consignment_id")
  if (!consignmentId) {
    return NextResponse.json({ error: "consignment_id is required" }, { status: 400 })
  }

  try {
    if (!isMacShipConfigured()) {
      return NextResponse.json({ error: "Machship not configured" }, { status: 503 })
    }

    const token = getMachshipToken()
    const url = getLabelsUrl(consignmentId)
    const upstream = await fetch(url, {
      headers: {
        token,
        Accept: "application/pdf",
      },
    })

    if (!upstream.ok) {
      const text = await upstream.text()

      // Some carriers (e.g. Aramex parcel) don't use Machship-generated labels -
      // they print their own. Machship returns 500 with this specific message.
      // Return a friendly 200 with a flag so the UI can show a helpful note.
      if (/does not need consignment labels/i.test(text)) {
        return NextResponse.json(
          {
            label_available: false,
            carrier_handles_own_labels: true,
            message:
              "This carrier handles its own labels directly (no Machship label). The carrier will attach its own label at pickup.",
          },
          { status: 200 },
        )
      }

      return NextResponse.json(
        { error: `Machship labels request failed (${upstream.status}): ${text}` },
        { status: upstream.status },
      )
    }

    const pdf = await upstream.arrayBuffer()
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="labels-${consignmentId}.pdf"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
