"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import {
  useImportMarketingContacts,
  type ImportResult,
  type ImportRow,
} from "@/lib/hooks/use-marketing-contacts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type FieldKey =
  | "ignore"
  | "first_name"
  | "last_name"
  | "full_name"
  | "email"
  | "phone"
  | "company_name"
  | "state"
  | "tags"

const FIELD_OPTIONS: Array<{ value: FieldKey; label: string }> = [
  { value: "ignore", label: "— Ignore —" },
  { value: "full_name", label: "Contact name (full)" },
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company_name", label: "Company / business name" },
  { value: "state", label: "State" },
  { value: "tags", label: "Tags (semicolon-separated)" },
]

// Auto-detect heuristics: lowercased, non-alphanumeric stripped, substring match.
const AUTO_MATCH: Array<{ pattern: RegExp; field: FieldKey }> = [
  { pattern: /^(full|contact)?name$/i, field: "full_name" },
  { pattern: /^first/i, field: "first_name" },
  { pattern: /^last|surname/i, field: "last_name" },
  { pattern: /email|mail/i, field: "email" },
  { pattern: /phone|mobile|cell|tel/i, field: "phone" },
  { pattern: /company|business|organi[sz]ation/i, field: "company_name" },
  { pattern: /state|region/i, field: "state" },
  { pattern: /tag|segment|category/i, field: "tags" },
]

interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

/**
 * Server cap — matches MAX_ROWS_PER_REQUEST in the import route. Surfaced to
 * users so they know they need to split a >MAX_ROWS_PER_REQUEST file.
 */
const MAX_ROWS_PER_IMPORT = 200

function downloadCsvTemplate() {
  const headers = ["Contact Name", "Email", "Phone", "Business Name", "State", "Tags"]
  const sample = [
    "Jane Smith",
    "jane@example.com.au",
    "0412345678",
    "Example Pty Ltd",
    "QLD",
    "lead;qld",
  ]
  const csv = [
    headers.join(","),
    sample.map((c) => (c.includes(",") || c.includes(";") ? `"${c}"` : c)).join(","),
  ].join("\n")

  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "chemconnect-contacts-template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function ImportContactsPage() {
  const [csv, setCsv] = useState<ParsedCsv | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [mapping, setMapping] = useState<Record<number, FieldKey>>({})
  const [defaultTagsRaw, setDefaultTagsRaw] = useState<string>("")
  const [result, setResult] = useState<ImportResult | null>(null)

  const importMutation = useImportMarketingContacts()

  const defaultTags = useMemo(
    () =>
      defaultTagsRaw
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean),
    [defaultTagsRaw],
  )

  async function handleFile(file: File) {
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseCsv(text)
    setCsv(parsed)
    // Auto-map
    const auto: Record<number, FieldKey> = {}
    parsed.headers.forEach((header, i) => {
      const normalised = header.toLowerCase().replace(/[^a-z]/g, "")
      for (const { pattern, field } of AUTO_MATCH) {
        if (pattern.test(normalised)) {
          auto[i] = field
          return
        }
      }
      auto[i] = "ignore"
    })
    setMapping(auto)
    setResult(null)
  }

  function buildRows(): ImportRow[] {
    if (!csv) return []
    const rows: ImportRow[] = []
    for (const row of csv.rows) {
      const mapped: ImportRow = {}
      let fullName: string | undefined
      const tagCollector: string[] = []

      for (let i = 0; i < csv.headers.length; i++) {
        const field = mapping[i]
        const value = (row[i] ?? "").trim()
        if (!field || field === "ignore" || !value) continue

        switch (field) {
          case "full_name":
            fullName = value
            break
          case "first_name":
            mapped.first_name = value
            break
          case "last_name":
            mapped.last_name = value
            break
          case "email":
            mapped.email = value
            break
          case "phone":
            mapped.phone = value
            break
          case "company_name":
            mapped.company_name = value
            break
          case "state":
            mapped.state = value
            break
          case "tags":
            value.split(/[;,]/).forEach((t) => {
              const trimmed = t.trim()
              if (trimmed) tagCollector.push(trimmed)
            })
            break
        }
      }

      // If only full name given, split naively on first space
      if (fullName && !mapped.first_name && !mapped.last_name) {
        const [first, ...rest] = fullName.split(/\s+/)
        mapped.first_name = first
        if (rest.length) mapped.last_name = rest.join(" ")
      }

      if (tagCollector.length) mapped.tags = tagCollector
      rows.push(mapped)
    }
    return rows
  }

  const previewRows = useMemo(() => (csv ? csv.rows.slice(0, 5) : []), [csv])
  const rowsToImport = useMemo(
    () => buildRows(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [csv, mapping],
  )

  async function handleImport() {
    if (rowsToImport.length === 0) {
      toast.error("Nothing to import — check the column mapping.")
      return
    }
    if (rowsToImport.length > MAX_ROWS_PER_IMPORT) {
      toast.error(
        `File has ${rowsToImport.length} rows — server limit is ${MAX_ROWS_PER_IMPORT} per request. Split into smaller files.`,
      )
      return
    }
    try {
      const res = await importMutation.mutateAsync({
        rows: rowsToImport,
        default_tags: defaultTags.length > 0 ? defaultTags : undefined,
      })
      setResult(res)
      toast.success(
        `Imported ${res.created} new, updated ${res.updated}${res.failed ? `, ${res.failed} failed` : ""}.`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed"
      toast.error(message)
    }
  }

  function downloadFailedRows() {
    if (!result || !csv) return
    const failedIndices = result.results
      .filter((r) => r.status === "failed" || r.status === "skipped")
      .map((r) => ({ ...r }))
    if (failedIndices.length === 0) return
    const headers = [...csv.headers, "_reason"]
    const lines = [headers.join(",")]
    for (const f of failedIndices) {
      const raw = csv.rows[f.index] ?? []
      lines.push([...raw, f.reason ?? ""].map(csvCell).join(","))
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${fileName.replace(/\.csv$/i, "")}_failed.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/marketing/contacts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold tracking-tight">
            Import contacts from CSV
          </h2>
          <p className="text-sm text-muted-foreground">
            Each row is upserted into GoHighLevel and mirrored locally.
            Duplicates (by email or phone) update the existing record.
            Maximum {MAX_ROWS_PER_IMPORT} rows per upload - split larger
            files into batches.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCsvTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Download template
        </Button>
      </div>

      {!csv && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <p className="text-center text-sm text-muted-foreground">
              Drop a CSV file here or click to pick one. Expected columns:{" "}
              <strong>Contact Name, Email, Phone, Business Name, State, Tags</strong>.
              <br />
              <span className="text-xs">
                Excel (.xlsx) is not supported — export to CSV first.
              </span>
            </p>
            <Input
              type="file"
              accept=".csv,text/csv"
              className="max-w-sm"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
          </CardContent>
        </Card>
      )}

      {csv && !result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Step 1 — Map your columns
              </CardTitle>
              <CardDescription>
                File: <strong>{fileName}</strong> · {csv.rows.length} data rows
                detected. We auto-matched what we could — adjust any column that
                looks wrong.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CSV column</TableHead>
                      <TableHead>First row preview</TableHead>
                      <TableHead className="w-[220px]">Maps to</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csv.headers.map((header, i) => (
                      <TableRow key={`${header}-${i}`}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {previewRows[0]?.[i] ?? "(empty)"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping[i] ?? "ignore"}
                            onValueChange={(val) =>
                              setMapping((m) => ({
                                ...m,
                                [i]: val as FieldKey,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Step 2 — Default tags (optional)
              </CardTitle>
              <CardDescription>
                Applied to every imported row. Useful for marking an import batch,
                e.g. <code>import-apr-2026</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="e.g. import-apr-2026, qld-concrete"
                value={defaultTagsRaw}
                onChange={(e) => setDefaultTagsRaw(e.target.value)}
              />
              {defaultTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {defaultTags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Step 3 — Review & import</CardTitle>
              <CardDescription>
                Preview of the first 5 rows after mapping. Full import will send
                all {csv.rows.length} rows to GoHighLevel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(rowsToImport.slice(0, 5), null, 2)}
              </pre>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleImport}
                  disabled={importMutation.isPending || rowsToImport.length === 0}
                >
                  {importMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Import {rowsToImport.length} contacts
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCsv(null)
                    setFileName("")
                    setMapping({})
                    setDefaultTagsRaw("")
                  }}
                >
                  Cancel and upload a different file
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Import complete
            </CardTitle>
            <CardDescription>{fileName}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Total" value={result.total} />
              <Stat label="Created" value={result.created} tone="primary" />
              <Stat label="Updated" value={result.updated} />
              <Stat label="Skipped" value={result.skipped} tone="warning" />
              <Stat label="Failed" value={result.failed} tone="destructive" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/admin/marketing/contacts">Back to contacts</Link>
              </Button>
              {(result.failed > 0 || result.skipped > 0) && (
                <Button variant="outline" onClick={downloadFailedRows}>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Download failed rows
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setCsv(null)
                  setFileName("")
                  setMapping({})
                  setResult(null)
                }}
              >
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "primary" | "warning" | "destructive"
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "destructive"
          ? "text-destructive"
          : ""
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

/**
 * Minimal CSV parser — handles quoted fields with commas/newlines, escaped
 * quotes (""), UTF-8 BOM, and \r\n line endings. Good enough for admin CSV
 * imports generated by Excel/Google Sheets. For anything pathological we
 * fall back to cell-by-cell trimming.
 */
function parseCsv(text: string): ParsedCsv {
  // Strip UTF-8 BOM — Excel and Google Sheets include it on export and it
  // otherwise attaches to the first header cell, breaking auto-map.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const rows: string[][] = []
  let current: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ",") {
        current.push(field)
        field = ""
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++
        current.push(field)
        rows.push(current)
        current = []
        field = ""
      } else {
        field += c
      }
    }
  }
  if (field.length > 0 || current.length > 0) {
    current.push(field)
    rows.push(current)
  }

  // First non-empty row is headers
  const headers = rows.shift()?.map((h) => h.trim()) ?? []
  const dataRows = rows.filter((r) => r.some((cell) => cell.trim() !== ""))
  return { headers, rows: dataRows }
}

function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
