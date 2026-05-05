"use client"

// Bulk upload UI for the supplier freight matrix.
//
// Flow:
//   1. Admin clicks "Download sample template" (fully filled with AdBlue
//      Bulk + Pack rates from the planning docs) or "Download blank
//      template" and sends it to the supplier.
//   2. Supplier fills in their distance brackets + rate columns and
//      sends the file back.
//   3. Admin pastes the CSV or uploads the file here. We parse it
//      client-side, show one row per detected rate column, and let
//      admin pick a name / unit_type / active flag per column.
//   4. "Import" calls /api/admin/rate-sheets/bulk-import which creates
//      every rate sheet + bracket set in one transaction (rolls back
//      on failure so you never end up with half-imported data).

import { useState, useMemo } from "react"
import {
  parseFreightMatrix,
  type ParsedRateColumn,
} from "@/lib/fulfillment/freight-matrix-csv"

const UNIT_TYPES = [
  { value: "per_litre", label: "Per litre × distance" },
  { value: "flat_per_consignment", label: "Flat per consignment" },
  { value: "per_kg", label: "Per kg" },
  { value: "per_pallet", label: "Per pallet" },
  { value: "per_zone", label: "Per zone" },
] as const

interface ColumnDraft extends ParsedRateColumn {
  name: string
  unit_type: (typeof UNIT_TYPES)[number]["value"]
  is_active: boolean
  include: boolean
}

export function BulkUploadPanel({
  warehouseId,
  onImported,
  importEndpoint = "/api/admin/rate-sheets/bulk-import",
  templateEndpoint = "/api/admin/rate-sheets/template",
  helperText = "← Email the blank template to your supplier; they fill in the rate columns and send it back.",
}: {
  warehouseId: string
  onImported: () => void
  importEndpoint?: string
  templateEndpoint?: string
  helperText?: string
}) {
  const [open, setOpen] = useState(false)
  const [csvText, setCsvText] = useState("")
  const [drafts, setDrafts] = useState<ColumnDraft[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [rowCount, setRowCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const totalBrackets = useMemo(
    () =>
      drafts
        .filter((d) => d.include)
        .reduce((sum, d) => sum + d.brackets.length, 0),
    [drafts],
  )
  const includedCount = drafts.filter((d) => d.include).length

  const onFile = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    parse(text)
  }

  const parse = (text: string) => {
    setError(null)
    setSuccess(null)
    const result = parseFreightMatrix(text)
    setRowCount(result.rowCount)
    setWarnings(result.warnings)
    setDrafts(
      result.columns.map((c) => ({
        ...c,
        name: c.suggestedName,
        unit_type: c.suggestedUnitType,
        is_active: c.suggestedIsActive,
        // Default to including only Post-cutover (active) columns. Admin
        // can re-enable Pre-cutover ones if they want history.
        include: c.suggestedIsActive,
      })),
    )
  }

  const updateDraft = (idx: number, patch: Partial<ColumnDraft>) =>
    setDrafts((ds) => ds.map((d, i) => (i === idx ? { ...d, ...patch } : d)))

  const reset = () => {
    setCsvText("")
    setDrafts([])
    setWarnings([])
    setRowCount(0)
    setError(null)
    setSuccess(null)
  }

  const importBatch = async () => {
    setError(null)
    setSuccess(null)
    const sheetsToCreate = drafts
      .filter((d) => d.include && d.brackets.length > 0 && d.name.trim())
      .map((d) => ({
        name: d.name.trim(),
        unit_type: d.unit_type,
        is_active: d.is_active,
        brackets: d.brackets,
      }))
    if (sheetsToCreate.length === 0) {
      setError("Pick at least one column to import.")
      return
    }
    setImporting(true)
    const res = await fetch(importEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouse_id: warehouseId,
        sheets: sheetsToCreate,
      }),
    })
    setImporting(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? "Import failed.")
      return
    }
    const j = await res.json()
    setSuccess(
      `Imported ${j.created} rate sheet${j.created === 1 ? "" : "s"}.`,
    )
    onImported()
    // Auto-collapse after a short delay so the success message is visible.
    setTimeout(() => {
      reset()
      setOpen(false)
    }, 1500)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Bulk upload from CSV</h3>
          <p className="text-xs text-muted-foreground">
            Send a template to the supplier, then upload their filled-in
            sheet to create multiple rate sheets in one go.
          </p>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          {open ? "Hide" : "Open bulk upload"}
        </button>
      </header>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Download templates */}
          <div className="flex flex-wrap gap-2 text-xs">
            <a
              href={templateEndpoint}
              className="rounded bg-primary/10 px-3 py-1.5 font-medium text-primary hover:bg-primary/20"
              download
            >
              Download sample template (with AdBlue rates)
            </a>
            <a
              href={`${templateEndpoint}?empty=true`}
              className="rounded border border-border px-3 py-1.5 hover:bg-muted"
              download
            >
              Download blank template
            </a>
            <span className="self-center text-muted-foreground">
              {helperText}
            </span>
          </div>

          {/* File / paste input */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Upload .csv or .tsv file
              </span>
              <input
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                …or paste the contents
              </span>
              <textarea
                rows={4}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                onBlur={() => csvText && parse(csvText)}
                placeholder="Paste CSV / TSV here, then click outside or press Parse."
                className="w-full rounded border border-border bg-background px-2 py-1.5 font-mono text-xs"
              />
            </label>
          </div>

          {csvText && (
            <button
              onClick={() => parse(csvText)}
              className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              Re-parse
            </button>
          )}

          {warnings.length > 0 && (
            <ul className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
              {warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}

          {drafts.length > 0 && (
            <>
              <div className="rounded border border-border bg-muted/40 p-2 text-xs">
                Detected <strong>{drafts.length}</strong> rate column
                {drafts.length === 1 ? "" : "s"} across{" "}
                <strong>{rowCount}</strong> distance bracket
                {rowCount === 1 ? "" : "s"}. Tick the columns you want to
                import and adjust their settings, then click <em>Import</em>.
                Pre-cutover columns are unticked by default (treat as history).
              </div>

              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2">Import</th>
                      <th className="px-2 py-2">CSV column</th>
                      <th className="px-2 py-2">Rate sheet name</th>
                      <th className="px-2 py-2">Unit type</th>
                      <th className="px-2 py-2">Active</th>
                      <th className="px-2 py-2 text-right">Brackets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {drafts.map((d, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={d.include}
                            onChange={(e) =>
                              updateDraft(idx, { include: e.target.checked })
                            }
                          />
                        </td>
                        <td className="px-2 py-2 font-mono text-muted-foreground">
                          {d.header}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            value={d.name}
                            onChange={(e) =>
                              updateDraft(idx, { name: e.target.value })
                            }
                            className="w-full rounded border border-border bg-background px-1.5 py-1"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={d.unit_type}
                            onChange={(e) =>
                              updateDraft(idx, {
                                unit_type: e.target
                                  .value as ColumnDraft["unit_type"],
                              })
                            }
                            className="w-full rounded border border-border bg-background px-1.5 py-1"
                          >
                            {UNIT_TYPES.map((u) => (
                              <option key={u.value} value={u.value}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={d.is_active}
                            onChange={(e) =>
                              updateDraft(idx, { is_active: e.target.checked })
                            }
                          />
                        </td>
                        <td className="px-2 py-2 text-right text-muted-foreground">
                          {d.brackets.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={importBatch}
                  disabled={importing || includedCount === 0}
                  className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {importing
                    ? "Importing…"
                    : `Import ${includedCount} rate sheet${includedCount === 1 ? "" : "s"} (${totalBrackets} brackets)`}
                </button>
                <button
                  onClick={reset}
                  className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
                >
                  Clear
                </button>
              </div>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-emerald-700 dark:text-emerald-400">{success}</p>}
        </div>
      )}
    </div>
  )
}
