"use client"

import Link from "next/link"
import {
  BarChart3,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Send,
} from "lucide-react"

import {
  useMarketingCampaigns,
  type CampaignStatus,
  type MarketingCampaign,
} from "@/lib/hooks/use-marketing-campaigns"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-700",
}

export default function CampaignsListPage() {
  const { data, isLoading } = useMarketingCampaigns({ limit: 100 })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            One-off blasts, scheduled sends, and recurring newsletters.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/marketing/campaigns/new">
            <Plus className="mr-2 h-4 w-4" />
            New campaign
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading campaigns…
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Open rate</TableHead>
              <TableHead>Click rate</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.campaigns ?? []).map((c) => (
              <CampaignRow key={c.id} campaign={c} />
            ))}
            {data && data.campaigns.length === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No campaigns yet.{" "}
                  <Link
                    href="/admin/marketing/campaigns/new"
                    className="text-primary hover:underline"
                  >
                    Create your first campaign
                  </Link>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CampaignRow({ campaign }: { campaign: MarketingCampaign }) {
  const openRate =
    campaign.delivered_count > 0
      ? `${Math.round((campaign.opened_count / campaign.delivered_count) * 100)}%`
      : "—"
  const clickRate =
    campaign.delivered_count > 0
      ? `${Math.round((campaign.clicked_count / campaign.delivered_count) * 100)}%`
      : "—"

  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="font-medium">
        <Link
          href={`/admin/marketing/campaigns/${campaign.id}`}
          className="hover:underline"
        >
          {campaign.name}
        </Link>
      </TableCell>
      <TableCell>
        {campaign.type === "email" ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Mail className="h-3 w-3" /> Email
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <MessageCircle className="h-3 w-3" /> SMS
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLE[campaign.status]}`}
        >
          {campaign.status}
        </span>
      </TableCell>
      <TableCell>{campaign.audience_count}</TableCell>
      <TableCell>{campaign.delivered_count}</TableCell>
      <TableCell>{openRate}</TableCell>
      <TableCell>{clickRate}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {campaign.sent_at ? (
          new Date(campaign.sent_at).toLocaleString()
        ) : campaign.scheduled_at ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(campaign.scheduled_at).toLocaleString()}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Send className="h-3 w-3" /> Draft
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {/* Only show on statuses where there's actual send activity to
            analyse. draft/scheduled/cancelled have no events yet. */}
        {(campaign.status === "sent" ||
          campaign.status === "sending" ||
          campaign.status === "failed") && (
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/admin/marketing/campaigns/${campaign.id}/analytics`}
              aria-label={`View analytics for ${campaign.name}`}
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Analytics
            </Link>
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}
