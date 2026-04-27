"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Search,
  UserMinus,
} from "lucide-react"
import { toast } from "sonner"

import {
  useCampaignAnalytics,
  useUnenrollFromCampaign,
  type CampaignRecipient,
  type RecipientStatus,
} from "@/lib/hooks/use-marketing-campaigns"
import { useDebounce } from "@/lib/hooks/use-debounce"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
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

const PAGE_SIZE = 25

const STATUS_STYLE: Record<RecipientStatus, string> = {
  delivered: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  opened: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  clicked: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  bounced: "bg-red-500/10 text-red-600 dark:text-red-400",
  complained: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  unsubscribed: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
  enrolled: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  unenrolled: "bg-slate-500/10 text-slate-500 line-through dark:text-slate-400",
  unknown: "bg-muted text-muted-foreground",
}

export default function CampaignAnalyticsPage() {
  const params = useParams<{ id: string }>()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchDraft, setSearchDraft] = useState("")
  const search = useDebounce(searchDraft, 300)

  // Single-contact and bulk "remove from workflow" state. Only relevant for
  // ghl_workflow campaigns - the action itself is gated on campaign.type, but
  // these pieces of state are shared across both flows to reuse the confirm
  // dialog component.
  const [unenrollTarget, setUnenrollTarget] = useState<CampaignRecipient | null>(null)
  const [bulkUnenrollOpen, setBulkUnenrollOpen] = useState(false)
  const unenroll = useUnenrollFromCampaign()

  const { data, isLoading, isFetching, isError } = useCampaignAnalytics(
    params.id,
    {
      page,
      size: PAGE_SIZE,
      status: statusFilter === "all" ? undefined : statusFilter,
      q: search || undefined,
    },
  )

  async function handleUnenrollOne() {
    if (!unenrollTarget || !params.id) return
    const name =
      unenrollTarget.full_name || unenrollTarget.email || "this contact"
    const promise = unenroll.mutateAsync({
      id: params.id,
      body: { contactIds: [unenrollTarget.contact_id] },
    })
    toast.promise(promise, {
      loading: `Removing ${name}…`,
      success: (res) =>
        res.succeeded > 0
          ? `${name} removed from workflow`
          : res.skipped > 0
            ? `${name} was already not in the workflow`
            : `Could not remove ${name}`,
      error: "Failed to remove contact",
    })
    await promise.catch(() => undefined)
    setUnenrollTarget(null)
  }

  async function handleUnenrollAll() {
    if (!params.id) return
    const promise = unenroll.mutateAsync({
      id: params.id,
      body: { all: true },
    })
    toast.promise(promise, {
      loading: "Removing everyone still enrolled…",
      success: (res) =>
        `Removed ${res.succeeded} · skipped ${res.skipped}${
          res.failed ? ` · ${res.failed} failed` : ""
        }`,
      error: "Bulk removal failed",
    })
    await promise.catch(() => undefined)
    setBulkUnenrollOpen(false)
  }

  function exportCsv() {
    if (!data) return
    const rows = data.recipients.rows
    const header = [
      "Name",
      "Email",
      "Status",
      "Last Activity",
      "Delivered",
      "Opened",
      "Clicked",
      "Last Click URL",
    ]
    const body = rows.map((r) =>
      [
        r.full_name ?? "",
        r.email ?? "",
        r.status,
        r.last_activity_at ?? "",
        r.delivered_at ?? "",
        r.opened_at ?? "",
        r.clicked_at ?? "",
        r.last_click_url ?? "",
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    )
    const csv = [header.join(","), ...body].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${data.campaign.name || "campaign"}-recipients.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="text-sm text-destructive">
        Could not load analytics.
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/admin/marketing/campaigns">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to campaigns
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  const { campaign, metrics, recipients } = data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/marketing/campaigns/${campaign.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {campaign.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {campaign.type === "ghl_workflow"
              ? `Workflow: ${campaign.ghl_workflow_name ?? "(unknown)"}`
              : campaign.subject || "No subject"}
          </p>
        </div>
        {campaign.type === "ghl_workflow" && (campaign.enrolled_count ?? 0) > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkUnenrollOpen(true)}
            disabled={unenroll.isPending}
          >
            {unenroll.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserMinus className="mr-2 h-4 w-4" />
            )}
            Remove all enrolled
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <MetricsGrid
        metrics={metrics}
        campaignType={campaign.type}
        enrolledCount={campaign.enrolled_count ?? 0}
        unenrolledCount={campaign.unenrolled_count ?? 0}
        workflowName={campaign.ghl_workflow_name ?? null}
      />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-sm">Recipients</CardTitle>
            <CardDescription>
              One row per contact, showing the most significant event and its
              timestamp. Excludes test sends.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value)
                  setPage(1)
                }}
                placeholder="Search name or email"
                className="w-[220px] pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {campaign.type === "ghl_workflow" ? (
                  <>
                    <SelectItem value="enrolled">Enrolled</SelectItem>
                    <SelectItem value="unenrolled">Unenrolled</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="clicked">Clicked</SelectItem>
                    <SelectItem value="bounced">Bounced</SelectItem>
                    <SelectItem value="complained">Complained</SelectItem>
                    <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Activity</TableHead>
                {campaign.type === "ghl_workflow" && (
                  <TableHead className="w-[80px] text-right">Action</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={campaign.type === "ghl_workflow" ? 5 : 4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {search || statusFilter !== "all"
                      ? "No recipients match the current filter."
                      : "No recipient activity yet. Events will appear as GHL webhooks arrive."}
                  </TableCell>
                </TableRow>
              ) : (
                recipients.rows.map((r) => (
                  <RecipientRow
                    key={r.contact_id}
                    recipient={r}
                    canUnenroll={campaign.type === "ghl_workflow"}
                    onUnenroll={setUnenrollTarget}
                    isUnenrolling={
                      unenroll.isPending &&
                      unenrollTarget?.contact_id === r.contact_id
                    }
                  />
                ))
              )}
            </TableBody>
          </Table>
          {recipients.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>
                Page {recipients.page} of {recipients.totalPages} ·{" "}
                {recipients.total} recipients
                {isFetching && (
                  <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />
                )}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                >
                  <ChevronLeft className="mr-1 h-3 w-3" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(recipients.totalPages, p + 1))
                  }
                  disabled={page >= recipients.totalPages || isFetching}
                >
                  Next
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!unenrollTarget}
        onOpenChange={(open) => {
          if (!open) setUnenrollTarget(null)
        }}
        title="Remove this contact from the workflow?"
        description={
          unenrollTarget
            ? `${
                unenrollTarget.full_name ??
                unenrollTarget.email ??
                "This contact"
              } will be removed from "${
                campaign.ghl_workflow_name ?? "the workflow"
              }". Emails already sent stay sent; any future steps (waits, follow-ups, branches) are cancelled.`
            : ""
        }
        confirmLabel="Remove from workflow"
        destructive
        onConfirm={handleUnenrollOne}
      />

      <ConfirmDialog
        open={bulkUnenrollOpen}
        onOpenChange={setBulkUnenrollOpen}
        title="Remove everyone still enrolled?"
        description={`Every contact currently enrolled in "${
          campaign.ghl_workflow_name ?? "this workflow"
        }" via this campaign will be removed. Already-sent emails stay in recipients' inboxes; queued follow-ups stop. This can't be undone, but you can re-enrol by sending the campaign again.`}
        confirmLabel="Remove all"
        destructive
        onConfirm={handleUnenrollAll}
      />
    </div>
  )
}

function MetricsGrid({
  metrics,
  campaignType,
  enrolledCount,
  unenrolledCount,
  workflowName,
}: {
  metrics: {
    audience: number
    delivered: number
    opened: number
    clicked: number
    bounced: number
    complained: number
    unsubscribed: number
    failed: number
  }
  campaignType: "email" | "sms" | "ghl_workflow"
  enrolledCount: number
  unenrolledCount: number
  workflowName: string | null
}) {
  const pct = (n: number) =>
    metrics.delivered > 0
      ? `${Math.round((n / metrics.delivered) * 100)}%`
      : metrics.audience > 0
        ? `${Math.round((n / metrics.audience) * 100)}%`
        : "-"
  // For SMS we only show Sent / Delivered / Failed - the other metrics
  // (Opened, Clicked, Bounced, Complained, Unsubscribed) don't exist or
  // aren't reliably surfaced by SMS carriers, so showing "0" would mislead.
  // Workflow campaigns show Audience + Enrolled + Failed, since per-email
  // opens/clicks aren't attributed back to this campaign (each email the
  // workflow sends is tracked by GHL as part of the workflow itself).
  // Email keeps the full 8-card layout to match GHL's dashboard.
  const cards = useMemo(() => {
    if (campaignType === "ghl_workflow") {
      return [
        { label: "Audience", value: metrics.audience, pct: null },
        {
          label: "Enrolled",
          value: enrolledCount,
          pct:
            metrics.audience > 0
              ? `${Math.round((enrolledCount / metrics.audience) * 100)}%`
              : null,
        },
        { label: "Unenrolled", value: unenrolledCount, pct: null },
        { label: "Failed", value: metrics.failed, pct: null },
      ]
    }
    const base = [
      { label: "Sent", value: metrics.audience, pct: null },
      {
        label: "Delivered",
        value: metrics.delivered,
        pct:
          metrics.audience > 0
            ? `${Math.round((metrics.delivered / metrics.audience) * 100)}%`
            : null,
      },
    ]
    if (campaignType === "sms") {
      return [
        ...base,
        { label: "Failed", value: metrics.failed, pct: pct(metrics.failed) },
      ]
    }
    return [
      ...base,
      { label: "Opened", value: metrics.opened, pct: pct(metrics.opened) },
      { label: "Clicked", value: metrics.clicked, pct: pct(metrics.clicked) },
      {
        label: "Complained",
        value: metrics.complained,
        pct: pct(metrics.complained),
      },
      { label: "Bounced", value: metrics.bounced, pct: pct(metrics.bounced) },
      {
        label: "Unsubscribed",
        value: metrics.unsubscribed,
        pct: pct(metrics.unsubscribed),
      },
      { label: "Failed", value: metrics.failed, pct: pct(metrics.failed) },
    ]
    // pct depends only on metrics; recomputing is cheap
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, campaignType, enrolledCount, unenrolledCount])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {c.label}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{c.value}</span>
                {c.pct && (
                  <span className="text-xs text-muted-foreground">{c.pct}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {campaignType === "ghl_workflow" && (
        <p className="text-xs text-muted-foreground">
          Workflow: <strong>{workflowName ?? "(unknown)"}</strong>. Per-email
          open and click stats for the workflow&apos;s messages are tracked
          inside GoHighLevel - open the workflow there to see them.
        </p>
      )}
    </div>
  )
}

function RecipientRow({
  recipient,
  canUnenroll,
  onUnenroll,
  isUnenrolling,
}: {
  recipient: CampaignRecipient
  canUnenroll: boolean
  onUnenroll: (r: CampaignRecipient) => void
  isUnenrolling: boolean
}) {
  const displayName =
    recipient.full_name || recipient.email || recipient.contact_id.slice(0, 8)
  const last = recipient.last_activity_at
    ? new Date(recipient.last_activity_at).toLocaleString()
    : "-"
  // Only offer the "remove" action for contacts who are actively in the
  // workflow. Removing a contact who already has status `unenrolled` /
  // `failed` is a no-op on GHL's side, so the button would be misleading.
  const canRemove = canUnenroll && recipient.status === "enrolled"
  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          href={`/admin/marketing/contacts/${recipient.contact_id}`}
          className="hover:underline"
        >
          {displayName}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {recipient.email ?? "-"}
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={`text-[10px] capitalize ${STATUS_STYLE[recipient.status]}`}
        >
          {recipient.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{last}</TableCell>
      {canUnenroll && (
        <TableCell className="text-right">
          {canRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUnenroll(recipient)}
              disabled={isUnenrolling}
              title="Remove this contact from the workflow. Emails already sent stay sent; future steps are cancelled."
            >
              {isUnenrolling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserMinus className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">Remove from workflow</span>
            </Button>
          )}
        </TableCell>
      )}
    </TableRow>
  )
}
