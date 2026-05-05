// GET /api/supplier/rate-sheets/template?empty=true|false
//
// Same CSV template as the admin endpoint, exposed to suppliers so they
// can download it from the supplier portal directly.

import { NextRequest } from "next/server"
import { requireSupplier } from "@/lib/supabase/supplier-check"
import { buildSampleFreightMatrixCsv } from "@/lib/fulfillment/freight-matrix-csv"

export async function GET(request: NextRequest) {
  const { error: authError } = await requireSupplier()
  if (authError) return authError

  const empty = request.nextUrl.searchParams.get("empty") === "true"
  let csv = buildSampleFreightMatrixCsv()

  if (empty) {
    const lines = csv.split("\n")
    const blanked = lines.map((line, idx) => {
      if (idx === 0) return line
      if (line.trim() === "") return line
      const cells = line.split(",")
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
