"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  Unlink,
  ChevronDown,
  ChevronRight,
  Building2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { get, post } from "@/lib/api/client"

interface XeroStatus {
  connected: boolean
  tenant_id?: string
  tenant_name?: string | null
  expires_at?: string
  scope?: string | null
}

interface SyncLogRow {
  id: string
  entity_type: string
  entity_id: string | null
  action: string
  status: string
  xero_id: string | null
  error_message: string | null
  request_payload: Record<string, unknown> | null
  response_payload: Record<string, unknown> | null
  created_at: string
}

export default function AdminXeroPage() {
  return (
    <Suspense fallback={<div className="text-muted-foreground">Loading...</div>}>
      <AdminXeroPageInner />
    </Suspense>
  )
}

function AdminXeroPageInner() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<XeroStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [logs, setLogs] = useState<SyncLogRow[]>([])
  const [availableTenantCount, setAvailableTenantCount] = useState<number>(0)

  // Check for query string flags from the OAuth callback
  useEffect(() => {
    const connected = searchParams.get("connected")
    const error = searchParams.get("error")
    if (connected) {
      toast.success("Xero connected successfully!")
    }
    if (error) {
      toast.error(`Xero connection failed: ${error}`)
    }
  }, [searchParams])

  async function loadStatus() {
    setLoading(true)
    try {
      const data = await get<XeroStatus>("/xero/status")
      setStatus(data)
      if (data.connected) {
        loadAvailableTenants()
      } else {
        setAvailableTenantCount(0)
      }
    } catch {
      setStatus({ connected: false })
      setAvailableTenantCount(0)
    } finally {
      setLoading(false)
    }
  }

  async function loadAvailableTenants() {
    try {
      const data = await get<{ tenants: Array<{ tenant_id: string }> }>(
        "/xero/available-tenants",
      )
      setAvailableTenantCount(data.tenants.length)
    } catch {
      // If we can't reach Xero, hide the switch button (count = 0 → not shown).
      setAvailableTenantCount(0)
    }
  }

  async function loadLogs() {
    try {
      const data = await get<SyncLogRow[]>("/xero/logs")
      setLogs(data)
    } catch {
      setLogs([])
    }
  }

  useEffect(() => {
    loadStatus()
    loadLogs()
  }, [])

  function handleConnect() {
    // Hard redirect so the cookie + OAuth flow work
    window.location.href = "/api/auth/xero"
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await post<{
        state: "switched" | "fully_disconnected" | "already_disconnected"
        tenant_name?: string
      }>("/xero/disconnect", {})
      if (res.state === "switched" && res.tenant_name) {
        toast.success(
          `Disconnected. Active tenant auto-switched to ${res.tenant_name}.`,
        )
      } else {
        toast.success("Xero disconnected.")
      }
      await loadStatus()
      await loadLogs()
    } catch (err) {
      toast.error("Failed to disconnect.")
      console.error(err)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Xero Integration</h1>
        <p className="text-muted-foreground">
          Connect your Xero account to automatically sync customers and invoices.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Connection Status
          </CardTitle>
          <CardDescription>
            One-click OAuth authorization. Tokens are refreshed automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking connection...
            </div>
          ) : status?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                <div className="flex-1">
                  <p className="font-medium text-emerald-500">
                    Connected to Xero
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {status.tenant_name || status.tenant_id}
                  </p>
                  {status.expires_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Token refreshes automatically. Current token valid until{" "}
                      {new Date(status.expires_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={disconnecting}>
                      {disconnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Disconnecting...
                        </>
                      ) : (
                        <>
                          <Unlink className="mr-2 h-4 w-4" />
                          Disconnect Xero
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Xero?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will need to reconnect to sync data. Any in-progress
                        syncs will stop.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnect}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {availableTenantCount > 1 && (
                  <Button variant="outline" asChild>
                    <Link href="/admin/xero/choose-org">
                      <Building2 className="mr-2 h-4 w-4" />
                      Switch Organisation
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" onClick={handleConnect}>
                  {availableTenantCount > 1 ? "Reconnect" : "Add Organisation"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <AlertCircle className="h-6 w-6 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-500">Not connected</p>
                  <p className="text-sm text-muted-foreground">
                    Connect your Xero account to enable automatic invoicing for
                    purchase orders.
                  </p>
                </div>
              </div>
              <Button onClick={handleConnect} className="glow-primary">
                <Link2 className="mr-2 h-4 w-4" />
                Connect to Xero
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Xero Workflow Info */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice &amp; PO Workflow</CardTitle>
          <CardDescription>
            How Xero documents are created based on payment method.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                <p className="font-semibold text-sm">Purchase Order payments</p>
              </div>
              <ol className="space-y-2 text-xs text-muted-foreground list-none">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-600">1</span>
                  Customer places order → status set to <span className="font-medium text-foreground">&quot;Pending Approval&quot;</span>. Customer receives an automated email confirming their order is under review.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-600">2</span>
                  Review the order and PO document on the <span className="font-medium text-foreground">Orders page</span>, then click Approve or Reject.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-600">3</span>
                  On approval: customer receives a <span className="font-medium text-foreground">confirmation email</span> with full order details.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-600">4</span>
                  A Xero <span className="font-medium text-foreground">invoice</span> is sent to the customer (status: Awaiting Payment).
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-600">5</span>
                  A Xero <span className="font-medium text-foreground">purchase order</span> is emailed to the warehouse (status: Approved — no manual approval needed in Xero).
                </li>
              </ol>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <p className="font-semibold text-sm">Card payments (Stripe)</p>
              </div>
              <ol className="space-y-2 text-xs text-muted-foreground list-none">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-600">1</span>
                  Order is <span className="font-medium text-foreground">auto-approved</span> immediately on payment.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-600">2</span>
                  Customer receives a <span className="font-medium text-foreground">receipt email</span> with full order details (Stripe also sends their own receipt).
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-600">3</span>
                  A Xero <span className="font-medium text-foreground">purchase order</span> is emailed to the warehouse immediately (status: Approved). No Xero invoice — Stripe handles the customer receipt.
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Recent Sync Activity</CardTitle>
              <CardDescription>
                Last 50 sync attempts. Failures here usually indicate a Xero API or
                data issue.
              </CardDescription>
            </div>
            <Link
              href="/admin/integration-logs?integration=xero"
              className="text-xs text-blue-600 hover:underline shrink-0"
            >
              View detailed logs →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync activity yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <SyncLogEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ----------------------------------------------------------------
// Sync log entry - expandable row with full request/response payloads
// ----------------------------------------------------------------
function SyncLogEntry({ log }: { log: SyncLogRow }) {
  const [open, setOpen] = useState(false)
  const hasPayload = !!(log.request_payload || log.response_payload)

  return (
    <div className="rounded-md border border-border/50 bg-muted/20 text-sm">
      <button
        type="button"
        onClick={() => hasPayload && setOpen(!open)}
        className={`flex w-full items-start justify-between gap-3 p-3 text-left ${
          hasPayload ? "cursor-pointer hover:bg-muted/30" : "cursor-default"
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {hasPayload &&
              (open ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ))}
            <Badge
              variant="outline"
              className={
                log.status === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "border-red-500/30 bg-red-500/10 text-red-500"
              }
            >
              {log.status}
            </Badge>
            <span className="font-medium">
              {log.entity_type} - {log.action}
            </span>
          </div>
          {log.error_message && (
            <p className="ml-5 mt-1 wrap-break-word text-xs text-red-400">
              {log.error_message}
            </p>
          )}
          {log.xero_id && (
            <p className="ml-5 mt-1 truncate text-xs text-muted-foreground">
              Xero ID: {log.xero_id}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(log.created_at).toLocaleString()}
        </span>
      </button>

      {open && hasPayload && (
        <div className="space-y-3 border-t border-border/50 bg-background/50 p-3">
          {log.request_payload && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Request payload sent to Xero
              </p>
              <pre className="max-h-80 overflow-auto rounded-md border border-border/50 bg-muted/30 p-3 text-xs">
                {JSON.stringify(log.request_payload, null, 2)}
              </pre>
            </div>
          )}
          {log.response_payload && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Response from Xero
              </p>
              <pre className="max-h-80 overflow-auto rounded-md border border-border/50 bg-muted/30 p-3 text-xs">
                {JSON.stringify(log.response_payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
