"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  ArrowUpRight,
  ExternalLink,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  TrendingUp,
  Users,
} from "lucide-react"

import { get } from "@/lib/api/client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const GHL_LOCATION_ID = "FQ5OnSrbC8BdZbTnWvp8"

interface DashboardResponse {
  month: {
    emails_sent_this_month: number
    sms_sent_this_month: number
    delivered_this_month: number
    opened_this_month: number
    clicked_this_month: number
    active_campaigns: number
    scheduled_campaigns: number
  } | null
  recentCampaigns: Array<{
    id: string
    name: string
    type: string
    status: string
    audience_count: number
    delivered_count: number
    open_rate: number
    click_rate: number
    sent_at: string | null
    scheduled_at: string | null
    created_at: string
  }>
  inbox: {
    unread_threads: number
    unread_messages: number
  } | null
  contacts: {
    total_contacts: number
    new_this_week: number
    opted_out: number
  } | null
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["marketing-dashboard"],
    queryFn: () => get<DashboardResponse>("/marketing/dashboard"),
    refetchOnWindowFocus: true,
  })

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
      </div>
    )
  }

  const openRate =
    data.month && data.month.delivered_this_month > 0
      ? Math.round(
          (data.month.opened_this_month / data.month.delivered_this_month) * 100,
        )
      : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrendingUp className="h-4 w-4" /> Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Top-line marketing stats. Full analytics live in GoHighLevel.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a
            href={`https://app.gohighlevel.com/v2/location/${GHL_LOCATION_ID}/settings/smtp_service`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open email services in GoHighLevel
          </a>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Widget
          icon={<Mail className="h-4 w-4" />}
          label="Emails sent this month"
          value={data.month?.emails_sent_this_month ?? 0}
        />
        <Widget
          icon={<MessageCircle className="h-4 w-4" />}
          label="SMS sent this month"
          value={data.month?.sms_sent_this_month ?? 0}
        />
        <Widget
          icon={<ArrowUpRight className="h-4 w-4" />}
          label="Open rate (this month)"
          value={openRate}
          suffix="%"
        />
        <Widget
          icon={<Inbox className="h-4 w-4" />}
          label="Unread inbox"
          value={data.inbox?.unread_messages ?? 0}
          accent={!!data.inbox && data.inbox.unread_messages > 0}
          cta={{ label: "Open inbox", href: "/admin/marketing/inbox" }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Widget
          icon={<Users className="h-4 w-4" />}
          label="Total contacts"
          value={data.contacts?.total_contacts ?? 0}
        />
        <Widget
          icon={<Users className="h-4 w-4" />}
          label="New this week"
          value={data.contacts?.new_this_week ?? 0}
        />
        <Widget
          icon={<Users className="h-4 w-4" />}
          label="Active + scheduled campaigns"
          value={
            (data.month?.active_campaigns ?? 0) +
            (data.month?.scheduled_campaigns ?? 0)
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent campaigns</CardTitle>
          <CardDescription>
            Last 8 campaigns across email and SMS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaigns yet.{" "}
              <Link
                href="/admin/marketing/campaigns/new"
                className="text-primary hover:underline"
              >
                Create your first
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {data.recentCampaigns.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <div className="flex-1">
                    <Link
                      href={`/admin/marketing/campaigns/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c.type.toUpperCase()} · {c.audience_count} recipients
                      {c.sent_at && ` · sent ${new Date(c.sent_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant="outline">{c.status}</Badge>
                    <span className="text-muted-foreground">
                      Opens {c.open_rate}%
                    </span>
                    <span className="text-muted-foreground">
                      Clicks {c.click_rate}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Widget({
  icon,
  label,
  value,
  suffix,
  accent,
  cta,
}: {
  icon: React.ReactNode
  label: string
  value: number
  suffix?: string
  accent?: boolean
  cta?: { label: string; href: string }
}) {
  return (
    <Card className={accent ? "border-primary" : undefined}>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          {icon} {label}
        </span>
        <span className="text-2xl font-semibold">
          {value}
          {suffix && (
            <span className="ml-0.5 text-base font-normal text-muted-foreground">
              {suffix}
            </span>
          )}
        </span>
        {cta && (
          <Link
            href={cta.href}
            className="mt-1 text-xs text-primary hover:underline"
          >
            {cta.label} →
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
