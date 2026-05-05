// GET /api/admin/rate-sheets/template?empty=true|false
//
// Downloads the sample freight matrix CSV admin can send to the supplier.
// Defaults to a fully-populated example using the AdBlue Bulk + Pack
// rates from the planning docs so admin can also use it to verify the
// import round-trip works end-to-end before sending it on.
//
// ?empty=true returns just the headers + first/last bracket rows so the
// supplier sees the structure but no pre-filled rates.

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/supabase/admin-check"
import { buildSampleFreightMatrixCsv } from "@/lib/fulfillment/freight-matrix-csv"

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const empty = request.nextUrl.searchParams.get("empty") === "true"
  let csv = buildSampleFreightMatrixCsv()

  if (empty) {
    // Keep header + 4001-4100 marker + first two brackets for shape only.
    const lines = csv.split("\n")
    const blanked = lines.map((line, idx) => {
      if (idx === 0) return line
      if (line.trim() === "") return line
      const cells = line.split(",")
      // keep from_km and to_km (cols 0-1), blank the rest
      return [cells[0], cells[1], ...cells.slice(2).map(() => "")].join(",")
    })
    csv = blanked.join("\n")
  }

  const filename = empty
    ? "freight-matrix-template-blank.csv"
    : "freight-matrix-template-sample.csv"

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
