// Parser for the supplier-supplied freight matrix CSV / TSV.
//
// Real-world supplier data looks like this (tab- or comma-separated):
//
//   from_km, to_km, Bulk (Pre-13Jul25), Bulk (Post 14Jul25), Pack (Pre-13Jul25), Pack Existing (Post-14Jul25), ...
//   0,       100,   $0.067,             $0.070,              $60.00,             $63.00,                       ...
//   101,     200,   $0.078,             $0.081,              $70.00,             $73.00,                       ...
//   4001,    4100,                                                                                              ← empty rates = out-of-range marker
//
// We accept:
//   - Tab or comma separators (auto-detect)
//   - Headers in any case, with whitespace, with arbitrary names for rate columns
//   - "from_km"/"to_km", "From (Km)"/"To (Km)", "from km"/"to km" — all map to the same fields
//   - Currency formatting: $0.067, $1,234.50, AUD 12.50, plain 67, plain 67.5
//   - Empty cells mean "no rate for this row in this column" — the row is
//     skipped for that rate sheet only, not the whole import
//   - Trailing whitespace and blank lines are ignored

export interface ParsedBracket {
  distance_from_km: number
  distance_to_km: number
  rate: number
}

export interface ParsedRateColumn {
  /** Column header as it appeared in the CSV */
  header: string
  /** Suggested rate sheet name (= header trimmed) */
  suggestedName: string
  /** Best-guess unit_type from header heuristics */
  suggestedUnitType:
    | "per_litre"
    | "flat_per_consignment"
    | "per_kg"
    | "per_pallet"
    | "per_zone"
  /** Best-guess is_active flag (Pre-July headers default to false) */
  suggestedIsActive: boolean
  /** Bracket rows for this column — only rows where the rate cell was non-empty */
  brackets: ParsedBracket[]
}

export interface ParseResult {
  columns: ParsedRateColumn[]
  rowCount: number
  warnings: string[]
}

// Header normalisation: lowercase, strip parens / punctuation, collapse
// whitespace. Matches "from_km", "From (Km)", "from km", "FROM-KM", etc.
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[()._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
const FROM_HEADERS = /^(from( km)?|distance from( km)?)$/
const TO_HEADERS = /^(to( km)?|distance to( km)?)$/

function detectDelimiter(text: string): "\t" | "," {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ""
  // Tab wins if it appears more than once on the first line; otherwise comma.
  const tabs = (firstLine.match(/\t/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  return tabs > commas ? "\t" : ","
}

/** Naive CSV row splitter that handles double-quoted fields. Good enough
 *  for the freight matrix, which never embeds commas inside fields. */
function splitRow(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === delim && !inQuotes) {
      out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map((c) => c.trim())
}

function parseRate(raw: string): number | null {
  if (!raw) return null
  // Strip currency markers, thousands separators, whitespace.
  const cleaned = raw.replace(/[$£€,\sAUD]/gi, "").trim()
  if (cleaned === "" || cleaned === "-") return null
  const n = parseFloat(cleaned)
  if (Number.isNaN(n)) return null
  return n
}

function parseInt0(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[,\s]/g, "")
  const n = parseInt(cleaned, 10)
  if (Number.isNaN(n)) return null
  return n
}

/** Heuristics to pre-fill unit_type and active flag from a column header.
 *  The admin can override every guess in the UI before importing. */
function suggestColumnDefaults(header: string): {
  unit_type: ParsedRateColumn["suggestedUnitType"]
  is_active: boolean
} {
  const h = header.toLowerCase()
  let unit_type: ParsedRateColumn["suggestedUnitType"] = "per_litre"
  if (/per\s*kg|kg\b/.test(h)) unit_type = "per_kg"
  else if (/pallet/.test(h)) unit_type = "per_pallet"
  else if (/zone/.test(h)) unit_type = "per_zone"
  else if (/pack|consignment|flat/.test(h))
    unit_type = "flat_per_consignment"
  else if (/bulk|litre|liter/.test(h)) unit_type = "per_litre"

  // Pre-cutover historical columns default to inactive so they don't
  // silently quote freight at obsolete rates.
  const isPre = /\bpre[-\s]?\d|pre[-\s]?(jul|jun|jan|feb|mar|apr|may|aug|sep|oct|nov|dec)/i.test(
    header,
  )
  return { unit_type, is_active: !isPre }
}

export function parseFreightMatrix(text: string): ParseResult {
  const warnings: string[] = []
  const lines = text
    .replace(/^﻿/, "") // strip BOM
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== "")
  if (lines.length < 2) {
    return { columns: [], rowCount: 0, warnings: ["No data rows found."] }
  }

  const delim = detectDelimiter(lines[0])
  const headers = splitRow(lines[0], delim)
  const fromIdx = headers.findIndex((h) => FROM_HEADERS.test(normalizeHeader(h)))
  const toIdx = headers.findIndex((h) => TO_HEADERS.test(normalizeHeader(h)))
  if (fromIdx < 0 || toIdx < 0) {
    return {
      columns: [],
      rowCount: 0,
      warnings: [
        `Couldn't find "from_km" or "to_km" headers. Found: ${headers.join(", ")}`,
      ],
    }
  }

  const rateIndices = headers
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => i !== fromIdx && i !== toIdx && headers[i] !== "")

  if (rateIndices.length === 0) {
    return {
      columns: [],
      rowCount: 0,
      warnings: ["No rate columns found beyond from_km / to_km."],
    }
  }

  const columns: ParsedRateColumn[] = rateIndices.map(({ h }) => {
    const defaults = suggestColumnDefaults(h)
    return {
      header: h,
      suggestedName: h.trim(),
      suggestedUnitType: defaults.unit_type,
      suggestedIsActive: defaults.is_active,
      brackets: [],
    }
  })

  let rowCount = 0
  for (let r = 1; r < lines.length; r++) {
    const cells = splitRow(lines[r], delim)
    const from = parseInt0(cells[fromIdx] ?? "")
    const to = parseInt0(cells[toIdx] ?? "")
    if (from === null || to === null) {
      // Empty bracket marker (like the 4001-4100 row with no rates) — silently skip.
      continue
    }
    if (to <= from) {
      warnings.push(`Row ${r + 1}: skipped (to_km ≤ from_km).`)
      continue
    }
    let rowContributed = false
    rateIndices.forEach(({ i }, cIdx) => {
      const rate = parseRate(cells[i] ?? "")
      if (rate === null) return
      columns[cIdx].brackets.push({
        distance_from_km: from,
        distance_to_km: to,
        rate,
      })
      rowContributed = true
    })
    if (rowContributed) rowCount++
  }

  return { columns, rowCount, warnings }
}

/** Generate a downloadable CSV template that matches the freight matrix
 *  format the user's existing supplier already uses. Pre-fills with the
 *  AdBlue rates from the brief so admin can sanity-check the import flow
 *  out of the box. */
export function buildSampleFreightMatrixCsv(): string {
  // Real AdBlue Bulk Post-14Jul25 rates from docs/Supplier-Managed-Fulfillment-Response.html
  // (and the Pack columns derived from the same matrix).
  const header = [
    "from_km",
    "to_km",
    "Bulk (Pre-13Jul25)",
    "Bulk (Post-14Jul25)",
    "Pack Existing (Pre-13Jul25)",
    "Pack Existing (Post-14Jul25)",
    "Pack New (Pre-13Jul25)",
    "Pack New (Post-14Jul25)",
  ]
  const rows: Array<(string | number)[]> = [
    [4001, 4100, "", "", "", "", "", ""],
    [0, 100, 0.067, 0.07, 60, 63, 67, 70],
    [101, 200, 0.078, 0.081, 70, 73, 78, 82],
    [201, 300, 0.09, 0.093, 80, 84, 90, 94],
    [301, 400, 0.11, 0.114, 100, 105, 110, 115],
    [401, 500, 0.123, 0.128, 110, 115, 137.5, 144],
    [501, 600, 0.135, 0.14, 120, 125, 150, 157],
    [601, 700, 0.156, 0.162, 140, 146, 175, 183],
    [701, 800, 0.179, 0.186, 160, 167, 200, 209],
    [801, 900, 0.201, 0.209, 180, 188, 225, 235],
    [901, 1000, 0.212, 0.22, 190, 198, 237.5, 248],
    [1001, 1100, 0.224, 0.233, 200, 209, 250, 261],
    [1101, 1200, 0.245, 0.255, 220, 230, 275, 287],
    [1201, 1300, 0.256, 0.266, 230, 240, 287.5, 300],
    [1301, 1400, 0.266, 0.276, 240, 250, 300, 313],
    [1401, 1500, 0.277, 0.288, 250, 261, 312.5, 326],
    [1501, 1600, 0.293, 0.304, 260, 271, 325, 339],
    [1601, 1700, 0.325, 0.338, 290, 303, 362.5, 378],
    [1701, 1800, 0.336, 0.349, 300, 313, 375, 391],
    [1801, 1900, 0.346, 0.359, 310, 323, 387.5, 404],
    [1901, 2000, 0.357, 0.371, 320, 334, 400, 417],
    [2001, 2100, 0.378, 0.393, 340, 355, 425, 443],
    [2101, 2200, 0.392, 0.407, 350, 365, 437.5, 456],
    [2201, 2300, 0.403, 0.419, 360, 375, 450, 469],
    [2301, 2400, 0.414, 0.43, 370, 386, 462.5, 482],
    [2401, 2500, 0.425, 0.441, 380, 396, 475, 495],
    [2501, 2600, 0.448, 0.465, 400, 417, 500, 521],
    [2601, 2700, 0.47, 0.488, 420, 438, 525, 547],
    [2701, 2800, 0.481, 0.5, 430, 448, 537.5, 560],
    [2801, 2900, 0.492, 0.511, 440, 459, 550, 573],
    [2901, 3000, 0.515, 0.535, 460, 480, 575, 599],
    [3001, 3100, 0.526, 0.546, 470, 490, 587.5, 612],
    [3101, 3200, 0.537, 0.558, 480, 500, 600, 625],
    [3201, 3300, 0.548, 0.569, 490, 511, 612.5, 638],
    [3301, 3400, 0.559, 0.581, 500, 521, 625, 651],
    [3401, 3500, 0.582, 0.605, 520, 542, 650, 677],
    [3501, 3600, 0.593, 0.616, 530, 552, 662.5, 690],
    [3601, 3700, 0.616, 0.64, 550, 573, 687.5, 717],
    [3701, 3800, 0.627, 0.651, 560, 584, 700, 730],
    [3801, 3900, 0.649, 0.674, 580, 605, 725, 756],
    [3901, 4000, 0.66, 0.686, 590, 615, 737.5, 769],
  ]

  return (
    [header, ...rows]
      .map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" && /[",\n]/.test(cell)
              ? `"${cell.replace(/"/g, '""')}"`
              : String(cell),
          )
          .join(","),
      )
      .join("\n") + "\n"
  )
}
