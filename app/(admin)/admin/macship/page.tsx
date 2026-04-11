"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle, Truck, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface MacShipStatus {
  configured: boolean
  mode: "test" | "production"
  hasTestToken: boolean
  hasProductionToken: boolean
}

interface FailedUpdate {
  id: string
  order_id: string
  order_number: string | null
  order_status: string | null
  consignment_id: string | null
  error_message: string | null
  created_at: string
  resolved: boolean
}

interface ActivityEntry {
  id: string
  order_number: string
  status: string
  created_at: string
  macship_consignment_id: string | null
  macship_carrier_id: string | null
  macship_pickup_date: string | null
  macship_dispatched_at: string | null
  macship_tracking_url: string | null
  macship_manifest_id: string | null
  macship_consignment_failed: boolean | null
  macship_lead_time_fallback: boolean | null
}

export default function AdminMacShipPage() {
  const [status, setStatus] = useState<MacShipStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [testing, setTesting] = useState(false)
  const [syncingTracking, setSyncingTracking] = useState(false)
  const [failedUpdates, setFailedUpdates] = useState<FailedUpdate[]>([])
  const [loadingFailed, setLoadingFailed] = useState(true)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)

  async function loadStatus() {
    setLoadingStatus(true)
    try {
      const res = await fetch("/api/macship/test")
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      } else {
        setStatus(null)
      }
    } catch {
      setStatus(null)
    } finally {
      setLoadingStatus(false)
    }
  }

  async function loadFailedUpdates() {
    setLoadingFailed(true)
    try {
      const res = await fetch("/api/macship/failed-updates")
      if (res.ok) {
        const data = await res.json()
        setFailedUpdates(data)
      } else {
        setFailedUpdates([])
      }
    } catch {
      setFailedUpdates([])
    } finally {
      setLoadingFailed(false)
    }
  }

  async function loadActivity() {
    setLoadingActivity(true)
    try {
      const res = await fetch("/api/macship/activity")
      if (res.ok) setActivity(await res.json())
      else setActivity([])
    } catch {
      setActivity([])
    } finally {
      setLoadingActivity(false)
    }
  }

  useEffect(() => {
    loadStatus()
    loadFailedUpdates()
    loadActivity()
  }, [])

  async function handleTestConnection() {
    setTesting(true)
    try {
      const res = await fetch("/api/macship/test")
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
        if (data.configured) {
          toast.success(`MacShip connected — running in ${data.mode} mode`)
        } else {
          toast.error("MacShip not configured — set API tokens in environment variables")
        }
      } else {
        toast.error("Could not reach MacShip test endpoint")
      }
    } catch {
      toast.error("Connection test failed")
    } finally {
      setTesting(false)
    }
  }

  async function handleSyncTracking() {
    setSyncingTracking(true)
    try {
      const res = await fetch("/api/macship/sync-tracking")
      if (res.ok) {
        const data = await res.json()
        if (data.message) {
          toast.info(data.message)
        } else {
          const synced = data.synced ?? 0
          const delivered = data.delivered ?? 0
          toast.success(
            `Tracking synced — ${synced} polled${delivered > 0 ? `, ${delivered} delivered` : ""}`,
          )
        }
        await loadFailedUpdates()
        await loadActivity()
      } else {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error || "Sync tracking failed")
      }
    } catch {
      toast.error("Sync tracking failed")
    } finally {
      setSyncingTracking(false)
    }
  }

  async function handleResolve(id: string) {
    try {
      const res = await fetch("/api/macship/failed-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        toast.success("Marked as resolved")
        setFailedUpdates((prev) => prev.filter((u) => u.id !== id))
      } else {
        toast.error("Failed to mark as resolved")
      }
    } catch {
      toast.error("Failed to mark as resolved")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MacShip Integration</h1>
        <p className="text-muted-foreground">
          Manage carrier consignments, dispatch, and tracking via MacShip.
        </p>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Connection Status
          </CardTitle>
          <CardDescription>
            MacShip API tokens are configured via environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStatus ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking configuration...
            </div>
          ) : status?.configured ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-500" />
                <div className="flex-1">
                  <p className="font-medium text-emerald-500">MacShip configured</p>
                  <p className="text-sm text-muted-foreground">
                    Running in{" "}
                    <Badge variant="outline" className="ml-1 text-xs capitalize">
                      {status.mode}
                    </Badge>{" "}
                    mode
                  </p>
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {status.hasTestToken ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      Test token
                    </span>
                    <span className="flex items-center gap-1">
                      {status.hasProductionToken ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-muted-foreground" />
                      )}
                      Production token
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                  {testing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Testing...</>
                  ) : (
                    <><RefreshCw className="mr-2 h-4 w-4" />Recheck</>
                  )}
                </Button>
                <Button onClick={handleSyncTracking} disabled={syncingTracking}>
                  {syncingTracking ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Syncing...</>
                  ) : (
                    <><RefreshCw className="mr-2 h-4 w-4" />Sync Tracking</>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <AlertTriangle className="h-6 w-6 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-500">Not configured</p>
                  <p className="text-sm text-muted-foreground">
                    Set <code className="text-xs bg-muted px-1 rounded">MACSHIP_TEST_API_TOKEN</code> or{" "}
                    <code className="text-xs bg-muted px-1 rounded">MACSHIP_PRODUCTION_API_TOKEN</code> in your
                    environment variables. Set{" "}
                    <code className="text-xs bg-muted px-1 rounded">MACSHIP_MODE</code> to{" "}
                    <code className="text-xs bg-muted px-1 rounded">production</code> when ready to go live.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                {testing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking...</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" />Recheck Configuration</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Failed Updates Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Failed Tracking Updates
          </CardTitle>
          <CardDescription>
            MacShip tracking updates that failed and need attention. Resolve manually or retry sync.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingFailed ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading failed updates...
            </div>
          ) : failedUpdates.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              No failed updates — all good!
            </div>
          ) : (
            <div className="space-y-2">
              {failedUpdates.map((update) => (
                <div
                  key={update.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border/50 bg-muted/20 p-3 text-sm"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium font-mono text-xs">
                        {update.order_number || update.order_id}
                      </span>
                      {update.order_status && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {update.order_status.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                    {update.consignment_id && (
                      <p className="text-xs text-muted-foreground">
                        Consignment: <span className="font-mono">{update.consignment_id}</span>
                      </p>
                    )}
                    {update.error_message && (
                      <p className="text-xs text-amber-500 break-words">{update.error_message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(update.created_at).toLocaleString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    onClick={() => handleResolve(update.id)}
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Recent MacShip Activity
          </CardTitle>
          <CardDescription>
            Last 20 orders with MacShip consignments — creation, dispatch, and tracking status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingActivity ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading activity...
            </div>
          ) : activity.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="h-4 w-4" />
              No MacShip consignments yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium font-mono text-xs">{entry.order_number}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {entry.status.replace("_", " ")}
                      </Badge>
                      {entry.macship_dispatched_at && (
                        <Badge className="border-0 bg-emerald-500/10 text-emerald-500 text-xs">Dispatched</Badge>
                      )}
                      {entry.macship_consignment_failed && (
                        <Badge className="border-0 bg-red-500/10 text-red-500 text-xs">⚠ Failed</Badge>
                      )}
                      {entry.macship_lead_time_fallback && (
                        <Badge className="border-0 bg-amber-500/10 text-amber-500 text-xs">Fallback LT</Badge>
                      )}
                    </div>
                    {entry.macship_consignment_id && (
                      <p className="text-xs text-muted-foreground">
                        Consignment:{" "}
                        <span className="font-mono">{entry.macship_consignment_id}</span>
                      </p>
                    )}
                    {entry.macship_pickup_date && (
                      <p className="text-xs text-muted-foreground">
                        Pickup:{" "}
                        {new Date(entry.macship_pickup_date).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {entry.macship_dispatched_at && (
                          <> · Dispatched{" "}
                            {new Date(entry.macship_dispatched_at).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                            })}
                          </>
                        )}
                      </p>
                    )}
                    {entry.macship_tracking_url && (
                      <a
                        href={entry.macship_tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Track Shipment →
                      </a>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
