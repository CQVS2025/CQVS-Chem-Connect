"use client"

import { useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  History,
  Loader2,
  RefreshCw,
  Save,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { get } from "@/lib/api/client"
import {
  useMarketingSettings,
  useUpdateMarketingSettings,
} from "@/lib/hooks/use-marketing-settings"
import { useForceSyncMarketingContacts } from "@/lib/hooks/use-marketing-contacts"

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
import { Label } from "@/components/ui/label"

const EDITABLE_KEYS: Array<{
  key: string
  label: string
  hint?: string
}> = [
  { key: "marketing.from_email", label: "From email", hint: "Address emails are sent from." },
  { key: "marketing.from_name", label: "From name", hint: "What recipients see as the sender." },
  { key: "marketing.reply_to", label: "Reply-to email" },
  {
    key: "marketing.business_name",
    label: "Business name",
    hint: "Used in the Spam Act footer.",
  },
  {
    key: "marketing.business_address",
    label: "Business address",
    hint: "Legally required in every marketing email footer (AU Spam Act 2003).",
  },
  { key: "marketing.sending_domain", label: "Sending domain" },
  {
    key: "marketing.sms_from_number",
    label: "SMS from number",
    hint: "AU mobile number provisioned in GoHighLevel (E.164).",
  },
]

export default function MarketingSettingsPage() {
  const { data, isLoading } = useMarketingSettings()
  const update = useUpdateMarketingSettings()
  const forceSync = useForceSyncMarketingContacts()

  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const draft: Record<string, string> = { ...(data?.settings ?? {}), ...overrides }
  const setDraft = (updater: (prev: Record<string, string>) => Record<string, string>) =>
    setOverrides((prev) => {
      const base = { ...(data?.settings ?? {}), ...prev }
      return updater(base)
    })

  async function handleSave() {
    const changed: Record<string, string> = {}
    for (const { key } of EDITABLE_KEYS) {
      if (draft[key] !== undefined && draft[key] !== data?.settings[key]) {
        changed[key] = draft[key]
      }
    }
    if (Object.keys(changed).length === 0) {
      toast.info("No changes to save.")
      return
    }
    try {
      await update.mutateAsync(changed)
      toast.success("Settings saved")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed"
      toast.error(message)
    }
  }

  async function handleForceSync() {
    // Sync is chunked client-side (Vercel Hobby's 10s cap per request);
    // the button text below reflects live progress from forceSync.progress.
    const promise = forceSync.mutateAsync()
    toast.promise(promise, {
      loading: "Re-syncing from GoHighLevel…",
      success: (res) =>
        `Synced ${res.total} contacts (${res.created} new, ${res.updated} updated${res.failed ? `, ${res.failed} failed` : ""}).`,
      error: "Sync failed",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            GoHighLevel connection
            {data?.ghl.status === "connected" ? (
              <Badge variant="secondary">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
              </Badge>
            ) : data?.ghl.status === "error" ? (
              <Badge variant="destructive">
                <XCircle className="mr-1 h-3 w-3" /> Error
              </Badge>
            ) : (
              <Badge variant="outline">Unknown</Badge>
            )}
          </CardTitle>
          {data?.ghl.location && (
            <CardDescription>
              Sub-account <strong>{data.ghl.location.name}</strong> · id{" "}
              <code className="text-xs">{data.ghl.location.id}</code>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleForceSync}
            disabled={forceSync.isPending}
          >
            {forceSync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {forceSync.isPending && forceSync.progress
              ? `Syncing ${forceSync.progress.totals.total}${
                  forceSync.progress.ghlTotal !== null
                    ? `/${forceSync.progress.ghlTotal}`
                    : ""
                } contacts…`
              : "Re-sync contacts from GoHighLevel"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sender identity &amp; compliance</CardTitle>
          <CardDescription>
            These values are injected into every outbound send.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {EDITABLE_KEYS.map(({ key, label, hint }) => (
            <div key={key} className={key === "marketing.business_address" ? "sm:col-span-2" : undefined}>
              <Label className="mb-1.5">{label}</Label>
              <Input
                value={draft[key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              />
              {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
            </div>
          ))}
          <div className="sm:col-span-2 flex gap-2">
            <Button onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <AuditLogCard />
    </div>
  )
}

interface AuditEntry {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  meta: Record<string, unknown>
  occurred_at: string
  actor: { id: string; contact_name: string | null } | null
}

interface AuditResponse {
  entries: AuditEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const AUDIT_PAGE_SIZE = 25

function AuditLogCard() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["marketing-audit-log", page],
    queryFn: () =>
      get<AuditResponse>(
        `/marketing/audit-log?page=${page}&limit=${AUDIT_PAGE_SIZE}`,
      ),
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })

  const totalPages = data?.totalPages ?? 1
  const total = data?.total ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4" /> Audit log
          {isFetching && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </CardTitle>
        <CardDescription>
          Every marketing action logged for audit &amp; compliance. Showing{" "}
          {total === 0 ? 0 : (page - 1) * AUDIT_PAGE_SIZE + 1}-
          {Math.min(page * AUDIT_PAGE_SIZE, total)} of {total}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data?.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        ) : (
          <>
            <ul className="divide-y text-sm">
              {(data?.entries ?? []).map((e) => (
                <li key={e.id} className="flex items-start gap-3 py-2">
                  <span className="min-w-[180px] font-mono text-xs text-muted-foreground">
                    {new Date(e.occurred_at).toLocaleString()}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{e.action}</p>
                    {e.actor?.contact_name && (
                      <p className="text-xs text-muted-foreground">
                        by {e.actor.contact_name}
                      </p>
                    )}
                    {e.target_type && e.target_id && (
                      <p className="text-xs text-muted-foreground">
                        {e.target_type} · {e.target_id.slice(0, 8)}…
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                <span>
                  Page <strong className="text-foreground">{page}</strong> of{" "}
                  {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isFetching}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
