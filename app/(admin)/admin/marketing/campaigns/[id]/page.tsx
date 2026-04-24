"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Send,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import {
  useCancelCampaign,
  useDeleteCampaign,
  useMarketingCampaign,
  useSendCampaign,
  useTestSendCampaign,
} from "@/lib/hooks/use-marketing-campaigns"
import { useMarketingContacts } from "@/lib/hooks/use-marketing-contacts"
import { post } from "@/lib/api/client"

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
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

const GHL_LOCATION_ID = "FQ5OnSrbC8BdZbTnWvp8"

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data, isLoading } = useMarketingCampaign(params.id)
  const sendCampaign = useSendCampaign()
  const testSend = useTestSendCampaign()
  const deleteCampaign = useDeleteCampaign()
  const cancelCampaign = useCancelCampaign()

  const [testQ, setTestQ] = useState("")
  const { data: testCandidates } = useMarketingContacts({ q: testQ, limit: 5 })

  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Live audience preview — resolves the campaign's audience_filter against
  // the current contacts table so the Send button always shows an accurate
  // count, not the stale value stored at creation time.
  const { data: previewData, isFetching: isPreviewFetching } = useQuery({
    queryKey: ["campaign-preview", params.id],
    queryFn: () =>
      post<{ audienceCount: number }>(`/marketing/campaigns/${params.id}/preview`),
    enabled: !!params.id && !!data && ["draft", "scheduled"].includes(data.campaign.status),
    refetchOnWindowFocus: true,
  })

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading campaign…
      </div>
    )
  }

  const { campaign, events } = data
  const isSendable = ["draft", "scheduled"].includes(campaign.status)

  async function handleSendConfirmed() {
    const promise = sendCampaign.mutateAsync(campaign.id)
    toast.promise(promise, {
      loading: "Dispatching…",
      success: (res) =>
        `Sent: ${res.succeeded} · Failed: ${res.failed} · Skipped: ${res.skipped}`,
      error: "Send failed",
    })
    await promise.catch(() => undefined)
  }

  async function handleTestSend(contactId: string) {
    const promise = testSend.mutateAsync({ id: campaign.id, contactId })
    toast.promise(promise, {
      loading: "Sending test…",
      success: "Test sent",
      error: "Test failed",
    })
  }

  async function handleDeleteConfirmed() {
    try {
      await deleteCampaign.mutateAsync(campaign.id)
      toast.success("Campaign deleted")
      router.push("/admin/marketing/campaigns")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed"
      toast.error(message)
    }
  }

  async function handleCancelConfirmed() {
    try {
      await cancelCampaign.mutateAsync(campaign.id)
      toast.success("Campaign cancelled")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cancel failed"
      toast.error(message)
    }
  }

  // For drafts/scheduled we show the live preview count (filter resolved
  // against current contacts). Once sent, the stored audience_count is the
  // authoritative number.
  const displayAudienceCount =
    ["draft", "scheduled"].includes(campaign.status) && previewData
      ? previewData.audienceCount
      : campaign.audience_count

  const deliveredRate =
    campaign.audience_count > 0
      ? Math.round((campaign.delivered_count / campaign.audience_count) * 100)
      : 0
  const openRate =
    campaign.delivered_count > 0
      ? Math.round((campaign.opened_count / campaign.delivered_count) * 100)
      : 0
  const clickRate =
    campaign.delivered_count > 0
      ? Math.round((campaign.clicked_count / campaign.delivered_count) * 100)
      : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/marketing/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold tracking-tight">{campaign.name}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{campaign.type.toUpperCase()}</Badge>
            <Badge variant="outline">{campaign.status}</Badge>
            <span>·</span>
            <span>{displayAudienceCount} recipients</span>
          </div>
        </div>
        {/* Deep-link to GHL. Email → Conversations inbox (see individual sent
            emails). SMS → Messaging Analytics dashboard (real-time delivery
            metrics that SMS protocols can't expose to us directly). */}
        <Button variant="outline" size="sm" asChild>
          <a
            href={
              campaign.type === "sms"
                ? `https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}/settings/phone_system?tab=messaging&childtab=messaging-analytics`
                : `https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}/conversations/conversations`
            }
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {campaign.type === "sms"
              ? "View SMS analytics in GoHighLevel"
              : "View sent messages in GoHighLevel"}
          </a>
        </Button>
        {isSendable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCancelDialogOpen(true)}
            disabled={
              cancelCampaign.isPending ||
              sendCampaign.isPending ||
              deleteCampaign.isPending
            }
          >
            {cancelCampaign.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="mr-2 h-4 w-4" />
            )}
            Cancel
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={
            campaign.status === "sending" ||
            sendCampaign.isPending ||
            cancelCampaign.isPending ||
            deleteCampaign.isPending
          }
        >
          {deleteCampaign.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Delete
        </Button>
      </div>

      {/* Opened/Clicked intentionally hidden for SMS — the SMS protocol
          doesn't provide read receipts or click data, so showing "0" would
          be misleading. Email campaigns show the full 4-stat grid. */}
      <div
        className={`grid gap-4 ${
          campaign.type === "sms"
            ? "sm:grid-cols-2"
            : "sm:grid-cols-2 lg:grid-cols-4"
        }`}
      >
        <Stat label="Audience" value={displayAudienceCount} />
        <Stat
          label="Delivered"
          value={campaign.delivered_count}
          suffix={deliveredRate ? `(${deliveredRate}%)` : ""}
        />
        {campaign.type === "email" && (
          <>
            <Stat
              label="Opened"
              value={campaign.opened_count}
              suffix={openRate ? `(${openRate}%)` : ""}
            />
            <Stat
              label="Clicked"
              value={campaign.clicked_count}
              suffix={clickRate ? `(${clickRate}%)` : ""}
            />
          </>
        )}
      </div>

      {isSendable && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ready to send?</CardTitle>
            <CardDescription>
              Test-send first to eyeball it in a real inbox, then fire the full campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Step 1 — Test-send to one person (optional)
              </p>
              <Input
                placeholder="Search a contact to test-send to…"
                value={testQ}
                onChange={(e) => setTestQ(e.target.value)}
              />
              {testCandidates && testCandidates.contacts.length > 0 && testQ && (
                <div className="mt-2 flex flex-col gap-1 rounded-md border p-2 text-sm">
                  {testCandidates.contacts.slice(0, 5).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex items-center justify-between rounded px-2 py-1 text-left hover:bg-muted"
                      onClick={() => handleTestSend(c.id)}
                      disabled={testSend.isPending}
                    >
                      <span>
                        {c.full_name ?? c.email ?? c.phone ?? "Contact"}{" "}
                        <span className="text-muted-foreground">
                          · {c.email ?? c.phone ?? ""}
                        </span>
                      </span>
                      <span className="text-xs text-primary">test send</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Step 2 — Send to full audience
              </p>
              <Button
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => setSendDialogOpen(true)}
                disabled={
                  sendCampaign.isPending ||
                  isPreviewFetching ||
                  displayAudienceCount === 0
                }
              >
                {sendCampaign.isPending || isPreviewFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {sendCampaign.isPending
                  ? "Dispatching…"
                  : isPreviewFetching
                    ? "Calculating audience…"
                    : displayAudienceCount === 0
                      ? "No contacts match this audience yet"
                      : `Send campaign to ${displayAudienceCount} contact${displayAudienceCount === 1 ? "" : "s"}`}
              </Button>
              {displayAudienceCount === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  The audience filter isn't matching any mirrored contacts.
                  Check the filter on Step 1 of the wizard or the{" "}
                  <Link
                    href="/admin/marketing/contacts"
                    className="text-primary hover:underline"
                  >
                    contacts list
                  </Link>
                  .
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {campaign.type === "email" && campaign.body_html && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              className="h-96 w-full rounded-md border bg-white"
              srcDoc={campaign.body_html}
              sandbox=""
              title="Email preview"
            />
          </CardContent>
        </Card>
      )}

      {campaign.type === "sms" && campaign.body_text && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Message</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
              {campaign.body_text}
            </pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <UserCheck className="h-4 w-4" /> Recent events
          </CardTitle>
          <CardDescription>
            Latest 200 delivered/opened/clicked/bounced/unsubscribed events from GHL webhooks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No events yet. Events flow in via webhook once GHL confirms a
              delivery/open/click.
            </p>
          ) : (
            <ul className="divide-y">
              {events.slice(0, 50).map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 py-2 text-sm">
                  <Badge variant="outline" className="capitalize">
                    {ev.event_type.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(ev.occurred_at).toLocaleString()}
                  </span>
                  {"url" in ev.metadata && (
                    <a
                      href={String((ev.metadata as { url?: string }).url ?? "#")}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {(ev.metadata as { url?: string }).url}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        title="Send this campaign now?"
        description={`"${campaign.name}" will be dispatched to approximately ${displayAudienceCount} contact(s). Delivery can't be undone once started.`}
        confirmLabel="Send now"
        onConfirm={handleSendConfirmed}
      />
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Cancel this campaign?"
        description={`"${campaign.name}" will be marked cancelled and won't fire at its scheduled time.`}
        confirmLabel="Cancel campaign"
        cancelLabel="Keep it"
        onConfirm={handleCancelConfirmed}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete this campaign?"
        description={`"${campaign.name}" will be permanently removed. Historical event data linked to it will remain but lose its campaign association.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string
  value: number
  suffix?: string
}) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-semibold">
        {value}
        {suffix && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {suffix}
          </span>
        )}
      </p>
    </div>
  )
}
