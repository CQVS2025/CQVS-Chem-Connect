"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, Building2, ArrowRight } from "lucide-react"
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
import { get, post } from "@/lib/api/client"

interface TenantOption {
  tenant_id: string
  tenant_name: string
}

interface AvailableTenantsResponse {
  active_tenant_id: string
  tenants: TenantOption[]
}

export default function ChooseXeroOrgPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isInitial = searchParams.get("initial") === "1"

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [activeTenantId, setActiveTenantId] = useState<string>("")
  const [selectedId, setSelectedId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await get<AvailableTenantsResponse>(
          "/xero/available-tenants",
        )
        if (cancelled) return
        setTenants(data.tenants)
        setActiveTenantId(data.active_tenant_id)
        setSelectedId(data.active_tenant_id)
      } catch (err) {
        if (cancelled) return
        setError(
          err instanceof Error ? err.message : "Failed to load organisations",
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleConfirm() {
    if (!selectedId) return
    setSubmitting(true)
    try {
      const res = await post<{ changed: boolean; tenant_name: string }>(
        "/xero/select-tenant",
        { tenant_id: selectedId },
      )
      toast.success(
        res.changed
          ? `Switched to ${res.tenant_name}. Stored Xero IDs from the previous org were cleared.`
          : `Active organisation: ${res.tenant_name}`,
      )
      router.push("/admin/xero?connected=1")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to select organisation",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Choose Xero Organisation
        </h1>
        <p className="text-muted-foreground">
          {isInitial
            ? "Your Xero account has access to multiple organisations. Pick the one this app should send invoices and purchase orders to."
            : "Switch the active Xero organisation. Invoices and POs will be created in the selected org going forward."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Authorized Organisations
          </CardTitle>
          <CardDescription>
            These are the Xero orgs your current connection can access. Only
            one can be active at a time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading organisations...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">
              {error}
            </div>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No organisations available. Try reconnecting to Xero.
            </p>
          ) : (
            <div className="space-y-2">
              {tenants.map((t) => {
                const isSelected = selectedId === t.tenant_id
                const isActive = activeTenantId === t.tenant_id
                return (
                  <button
                    type="button"
                    key={t.tenant_id}
                    onClick={() => setSelectedId(t.tenant_id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{t.tenant_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.tenant_id}
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                      >
                        Currently active
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => router.push("/admin/xero")}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={
            loading ||
            submitting ||
            !selectedId ||
            (selectedId === activeTenantId && !isInitial)
          }
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Use this organisation
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
