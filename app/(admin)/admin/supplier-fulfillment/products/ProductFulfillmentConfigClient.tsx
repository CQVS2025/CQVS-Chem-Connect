"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

interface ProductLite {
  id: string
  name: string
  slug: string
}

interface RateSheet {
  id: string
  name: string
  unit_type: string
  warehouse_id: string
}

interface RateSheetMapping {
  product_id: string
  packaging_size_id: string | null
  rate_sheet_id: string
}

interface CheckoutQuestion {
  id: string
  product_id: string
  packaging_size_id: string | null
  question_key: string
  label: string
  help_text: string | null
  question_type: "yes_no" | "text" | "number" | "select"
  options: Array<{ value: string; label: string }> | null
  required: boolean
  warning_when_value: string | null
  warning_copy: string | null
  display_order: number
  is_active: boolean
}

export function ProductFulfillmentConfigClient({
  products,
}: {
  products: ProductLite[]
}) {
  const search = useSearchParams()
  const initial = search.get("product") ?? products[0]?.id ?? ""
  const [productId, setProductId] = useState<string>(initial)
  const [rateSheets, setRateSheets] = useState<RateSheet[]>([])
  const [mappings, setMappings] = useState<RateSheetMapping[]>([])
  const [questions, setQuestions] = useState<CheckoutQuestion[]>([])

  const product = useMemo(
    () => products.find((p) => p.id === productId),
    [productId, products],
  )

  const reloadRateSheets = () =>
    fetch("/api/admin/rate-sheets")
      .then((r) => r.json())
      .then((d) => setRateSheets(Array.isArray(d) ? (d as RateSheet[]) : []))
  const reloadMappings = () =>
    productId &&
    fetch(`/api/admin/product-freight?product_id=${productId}`)
      .then((r) => r.json())
      .then((d) => setMappings(Array.isArray(d) ? d : []))
  const reloadQuestions = () =>
    productId &&
    fetch(`/api/admin/checkout-questions?product_id=${productId}`)
      .then((r) => r.json())
      .then((d) => setQuestions(Array.isArray(d) ? d : []))

  useEffect(() => {
    reloadRateSheets()
  }, [])
  useEffect(() => {
    reloadMappings()
    reloadQuestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-3">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Product
        </label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {product && (
          <p className="mt-1 text-xs text-muted-foreground">
            Slug: <code>{product.slug}</code>
          </p>
        )}
      </div>

      <RateSheetMappingSection
        productId={productId}
        rateSheets={rateSheets}
        mappings={mappings}
        onChange={reloadMappings}
      />

      <QuestionsSection
        productId={productId}
        questions={questions}
        onChange={reloadQuestions}
      />
    </div>
  )
}

// --------------------------------------------------------- Rate sheet mappings
function RateSheetMappingSection({
  productId,
  rateSheets,
  mappings,
  onChange,
}: {
  productId: string
  rateSheets: RateSheet[]
  mappings: RateSheetMapping[]
  onChange: () => void
}) {
  const allSizesMapping =
    mappings.find((m) => m.packaging_size_id === null) ?? null
  const [selected, setSelected] = useState(
    allSizesMapping?.rate_sheet_id ?? "",
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelected(allSizesMapping?.rate_sheet_id ?? "")
  }, [allSizesMapping?.rate_sheet_id])

  const save = async () => {
    if (!productId) return
    setSaving(true)
    setError(null)
    try {
      if (!selected) {
        const res = await fetch(
          `/api/admin/product-freight?product_id=${productId}`,
          { method: "DELETE" },
        )
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? "Failed to remove mapping")
        }
        toast.success("Rate sheet mapping removed (this product now uses MacShip)")
      } else {
        const res = await fetch("/api/admin/product-freight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            packaging_size_id: null,
            rate_sheet_id: selected,
          }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error ?? "Failed to save mapping")
        }
        toast.success("Rate sheet mapping saved")
      }
      onChange()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save"
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">Freight rate sheet</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Choose which rate sheet quotes freight for this product (covers all
        packaging sizes). Per-size overrides can be configured directly via
        <code> POST /api/admin/product-freight</code>.
      </p>
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">- No supplier rate sheet (uses MacShip) -</option>
          {rateSheets.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.unit_type})
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={saving}
          className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </section>
  )
}

// --------------------------------------------------------- Checkout questions
//
// Question editor shape - used both for the "Add a new question" form and
// the per-row "Edit" mode. Mirrors the columns admin can change without
// having to drop/recreate the row.
interface QuestionDraft {
  question_key: string
  label: string
  help_text: string
  question_type: CheckoutQuestion["question_type"]
  options: string // newline-separated "value|label" lines
  required: boolean
  warning_when_value: string
  warning_copy: string
  display_order: number
}

function emptyDraft(displayOrder: number): QuestionDraft {
  return {
    question_key: "",
    label: "",
    help_text: "",
    question_type: "yes_no",
    options: "",
    required: false,
    warning_when_value: "",
    warning_copy: "",
    display_order: displayOrder,
  }
}

function draftFromQuestion(q: CheckoutQuestion): QuestionDraft {
  return {
    question_key: q.question_key,
    label: q.label,
    help_text: q.help_text ?? "",
    question_type: q.question_type,
    options: Array.isArray(q.options)
      ? q.options.map((o) => `${o.value}|${o.label}`).join("\n")
      : "",
    required: q.required,
    warning_when_value: q.warning_when_value ?? "",
    warning_copy: q.warning_copy ?? "",
    display_order: q.display_order,
  }
}

function parseOptions(
  type: CheckoutQuestion["question_type"],
  raw: string,
): Array<{ value: string; label: string }> | null {
  if (type !== "select" || !raw.trim()) return null
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...rest] = line.split("|")
      return { value: value.trim(), label: (rest.join("|") || value).trim() }
    })
}

function QuestionsSection({
  productId,
  questions,
  onChange,
}: {
  productId: string
  questions: CheckoutQuestion[]
  onChange: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<QuestionDraft>(
    emptyDraft((questions.length + 1) * 10),
  )

  // Editing state - id of the question currently being edited inline,
  // and the in-flight draft. Only one row can be in edit mode at a time.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<QuestionDraft | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const addQuestion = async () => {
    if (!productId || !draft.question_key || !draft.label) {
      setError("question_key and label are required")
      return
    }
    setCreating(true)
    setError(null)
    const res = await fetch("/api/admin/checkout-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: productId,
        packaging_size_id: null,
        question_key: draft.question_key,
        label: draft.label,
        help_text: draft.help_text || null,
        question_type: draft.question_type,
        options: parseOptions(draft.question_type, draft.options),
        required: draft.required,
        warning_when_value: draft.warning_when_value || null,
        warning_copy: draft.warning_copy || null,
        display_order: draft.display_order,
        is_active: true,
      }),
    })
    setCreating(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? "Failed to create question")
      return
    }
    setDraft(emptyDraft((questions.length + 2) * 10))
    onChange()
  }

  const startEdit = (q: CheckoutQuestion) => {
    setEditingId(q.id)
    setEditDraft(draftFromQuestion(q))
    setEditError(null)
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(null)
    setEditError(null)
  }
  const saveEdit = async () => {
    if (!editingId || !editDraft) return
    if (!editDraft.question_key || !editDraft.label) {
      setEditError("question_key and label are required")
      return
    }
    setSavingEdit(true)
    setEditError(null)
    const res = await fetch(`/api/admin/checkout-questions/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_key: editDraft.question_key,
        label: editDraft.label,
        help_text: editDraft.help_text || null,
        question_type: editDraft.question_type,
        options: parseOptions(editDraft.question_type, editDraft.options),
        required: editDraft.required,
        warning_when_value: editDraft.warning_when_value || null,
        warning_copy: editDraft.warning_copy || null,
        display_order: editDraft.display_order,
      }),
    })
    setSavingEdit(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setEditError(j.error ?? "Failed to save changes")
      return
    }
    setEditingId(null)
    setEditDraft(null)
    onChange()
  }

  const remove = async (id: string) => {
    if (!confirm("Delete this question?")) return
    await fetch(`/api/admin/checkout-questions/${id}`, { method: "DELETE" })
    if (editingId === id) cancelEdit()
    onChange()
  }

  const toggleActive = async (q: CheckoutQuestion) => {
    await fetch(`/api/admin/checkout-questions/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !q.is_active }),
    })
    onChange()
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold">Site-access questions</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Shown on checkout when this product is in the cart. Answers are
        stored as <code>orders.site_access_answers</code>.
      </p>

      <ul className="mb-4 space-y-2">
        {questions.length === 0 && (
          <li className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
            No questions configured for this product yet.
          </li>
        )}
        {questions.map((q) => {
          const isEditing = editingId === q.id
          if (isEditing && editDraft) {
            // Inline edit form - same fields as "Add a new question"
            return (
              <li
                key={q.id}
                className="rounded border border-primary/40 bg-muted/30 p-3 text-sm"
              >
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Editing: {q.label}
                </p>
                <QuestionDraftForm draft={editDraft} setDraft={setEditDraft} />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                  >
                    {savingEdit ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    disabled={savingEdit}
                    className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  {editError && (
                    <span className="text-xs text-destructive">{editError}</span>
                  )}
                </div>
              </li>
            )
          }
          return (
            <li
              key={q.id}
              className="flex items-start justify-between gap-3 rounded border border-border bg-background p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {q.label}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({q.question_type}
                    {q.required ? " · required" : ""})
                  </span>
                  {!q.is_active && (
                    <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      Disabled
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  key: <code>{q.question_key}</code>
                  {q.warning_when_value &&
                    ` · warns when "${q.warning_when_value}"`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(q)}
                  disabled={editingId !== null && editingId !== q.id}
                  className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    editingId !== null && editingId !== q.id
                      ? "Finish editing the other question first"
                      : undefined
                  }
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(q)}
                  className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
                >
                  {q.is_active ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => remove(q.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <details className="rounded border border-border bg-muted/30 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Add a new question
        </summary>
        <div className="mt-3">
          <QuestionDraftForm draft={draft} setDraft={setDraft} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={addQuestion}
            disabled={creating}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {creating ? "Adding…" : "Add question"}
          </button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </details>
    </section>
  )
}

// Shared form fields for both "Add a new question" and "Edit existing
// question" panels. Stateless - receives the draft and a setter.
function QuestionDraftForm({
  draft,
  setDraft,
}: {
  draft: QuestionDraft
  setDraft: (d: QuestionDraft) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label="Question key">
        <input
          value={draft.question_key}
          onChange={(e) =>
            setDraft({ ...draft, question_key: e.target.value })
          }
          placeholder="e.g. truck_access_19m"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      <Field label="Type">
        <select
          value={draft.question_type}
          onChange={(e) =>
            setDraft({
              ...draft,
              question_type: e.target
                .value as CheckoutQuestion["question_type"],
            })
          }
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="yes_no">Yes / No</option>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Select (dropdown)</option>
        </select>
      </Field>
      <Field label="Label" className="sm:col-span-2">
        <input
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="What the buyer sees on checkout"
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      <Field label="Help text (optional)" className="sm:col-span-2">
        <input
          value={draft.help_text}
          onChange={(e) => setDraft({ ...draft, help_text: e.target.value })}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      {draft.question_type === "select" && (
        <Field
          label="Options (one per line, value|label)"
          className="sm:col-span-2"
        >
          <textarea
            rows={3}
            value={draft.options}
            onChange={(e) => setDraft({ ...draft, options: e.target.value })}
            placeholder={`camlock_2|2" Camlock\ndry_break|Dry-break`}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-mono"
          />
        </Field>
      )}
      <Field label="Warn when value =">
        <input
          value={draft.warning_when_value}
          onChange={(e) =>
            setDraft({ ...draft, warning_when_value: e.target.value })
          }
          placeholder='e.g. "no"'
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      <Field label="Required">
        <input
          type="checkbox"
          checked={draft.required}
          onChange={(e) =>
            setDraft({ ...draft, required: e.target.checked })
          }
          className="h-4 w-4"
        />
      </Field>
      <Field label="Warning copy" className="sm:col-span-2">
        <textarea
          rows={2}
          value={draft.warning_copy}
          onChange={(e) => setDraft({ ...draft, warning_copy: e.target.value })}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
      <Field label="Display order">
        <input
          type="number"
          value={draft.display_order}
          onChange={(e) =>
            setDraft({
              ...draft,
              display_order: parseInt(e.target.value, 10) || 0,
            })
          }
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
        />
      </Field>
    </div>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}
