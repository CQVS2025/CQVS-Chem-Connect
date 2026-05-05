"use client"

// Site-access questions component (Feature B, component 6).
//
// Fetches the active product_checkout_questions for the current cart's
// products+packaging-sizes from /api/checkout-questions and renders an
// inline form. Answers are bubbled up via onChange and submitted with
// the order as `site_access_answers jsonb`.
//
// When an answer matches `warning_when_value`, the question's
// `warning_copy` is displayed inline (component 7) but the order is
// allowed to proceed.

import { useEffect, useMemo, useState } from "react"

export interface SiteAccessQuestion {
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
}

interface CartLine {
  product_id: string
  packaging_size_id?: string | null
}

interface Props {
  cartItems: CartLine[]
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  /** Reports validity of required questions to the parent so it can
   *  block "Next" until they're answered. */
  onValidityChange?: (valid: boolean) => void
}

export function SiteAccessQuestions({
  cartItems,
  value,
  onChange,
  onValidityChange,
}: Props) {
  const [questions, setQuestions] = useState<SiteAccessQuestion[]>([])
  const [loading, setLoading] = useState(false)

  // Stable cart fingerprint so the effect doesn't refetch on every render.
  const cartKey = useMemo(
    () =>
      cartItems
        .map((c) => `${c.product_id}:${c.packaging_size_id ?? ""}`)
        .sort()
        .join("|"),
    [cartItems],
  )

  useEffect(() => {
    if (cartItems.length === 0) {
      setQuestions([])
      return
    }
    setLoading(true)
    const cartParam = JSON.stringify(
      cartItems.map((i) => ({
        product_id: i.product_id,
        packaging_size_id: i.packaging_size_id ?? null,
      })),
    )
    fetch(`/api/checkout-questions?cart=${encodeURIComponent(cartParam)}`)
      .then((r) => r.json())
      .then((j) => setQuestions(j.questions ?? []))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey])

  // Validity = every required question has a non-empty answer.
  useEffect(() => {
    const valid = questions
      .filter((q) => q.required)
      .every((q) => {
        const v = value[q.question_key]
        if (q.question_type === "yes_no") return v === "yes" || v === "no"
        if (q.question_type === "number") {
          return typeof v === "number" && !Number.isNaN(v)
        }
        return typeof v === "string" && v.trim().length > 0
      })
    onValidityChange?.(valid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, value])

  if (questions.length === 0) {
    return loading ? (
      <p className="text-xs text-muted-foreground">Loading delivery questions…</p>
    ) : null
  }

  const setAnswer = (key: string, v: unknown) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <header>
        <h3 className="text-sm font-semibold text-foreground">
          Delivery site questions
        </h3>
        <p className="text-xs text-muted-foreground">
          The supplier needs these answers to plan the delivery safely.
        </p>
      </header>
      <div className="space-y-3">
        {questions.map((q) => {
          const val = value[q.question_key]
          const showWarning =
            q.warning_when_value !== null &&
            q.warning_copy !== null &&
            val !== undefined &&
            val !== null &&
            String(val) === q.warning_when_value
          return (
            <div key={q.id} className="space-y-1">
              <label
                htmlFor={`q-${q.id}`}
                className="block text-sm font-medium text-foreground"
              >
                {q.label}
                {q.required && <span className="ml-1 text-destructive">*</span>}
              </label>
              {q.help_text && (
                <p className="text-xs text-muted-foreground">{q.help_text}</p>
              )}
              {renderInput(q, val, (next) => setAnswer(q.question_key, next))}
              {showWarning && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                  ⚠ {q.warning_copy}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function renderInput(
  q: SiteAccessQuestion,
  value: unknown,
  onChange: (v: unknown) => void,
) {
  const baseClass =
    "w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
  switch (q.question_type) {
    case "yes_no":
      return (
        <select
          id={`q-${q.id}`}
          value={value === "yes" || value === "no" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={baseClass}
        >
          <option value="">Select…</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      )
    case "number":
      return (
        <input
          id={`q-${q.id}`}
          type="number"
          inputMode="numeric"
          value={typeof value === "number" ? value : value === undefined || value === null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          className={baseClass}
        />
      )
    case "select":
      return (
        <select
          id={`q-${q.id}`}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={baseClass}
        >
          <option value="">Select…</option>
          {(q.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    case "text":
    default:
      return (
        <input
          id={`q-${q.id}`}
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
        />
      )
  }
}
