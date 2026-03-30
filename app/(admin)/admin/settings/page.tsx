"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"

import { useAdminSettings, useUpdateSettings } from "@/lib/hooks/use-settings"
import { PageTransition } from "@/components/shared/page-transition"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminSettingsPage() {
  const { data: settings, isLoading } = useAdminSettings()
  const updateSettings = useUpdateSettings()

  const [siteName, setSiteName] = useState("")
  const [supportEmail, setSupportEmail] = useState("")
  const [supportPhone, setSupportPhone] = useState("")
  const [currency, setCurrency] = useState("")
  const [taxRate, setTaxRate] = useState("")
  const [minOrderValue, setMinOrderValue] = useState("")
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [quotesEnabled, setQuotesEnabled] = useState(true)
  const [earlyAccessLimit, setEarlyAccessLimit] = useState("20")

  // Populate from API data
  useEffect(() => {
    if (settings) {
      setSiteName(settings.site_name || "Chem Connect")
      setSupportEmail(settings.support_email || "")
      setSupportPhone(settings.support_phone || "")
      setCurrency(settings.currency || "AUD")
      setTaxRate(settings.tax_rate || "10")
      setMinOrderValue(settings.min_order_value || "100")
      setEmailNotifications(settings.email_notifications_enabled !== "false")
      setQuotesEnabled(settings.quotes_enabled !== "false")
      setEarlyAccessLimit(settings.early_access_limit || "20")
    }
  }, [settings])

  function handleSave() {
    updateSettings.mutate(
      {
        site_name: siteName,
        support_email: supportEmail,
        support_phone: supportPhone,
        currency,
        tax_rate: taxRate,
        min_order_value: minOrderValue,
        email_notifications_enabled: emailNotifications ? "true" : "false",
        quotes_enabled: quotesEnabled ? "true" : "false",
        early_access_limit: earlyAccessLimit,
      },
      {
        onSuccess: () => toast.success("Settings saved successfully."),
        onError: () => toast.error("Unable to save settings. Please try again."),
      },
    )
  }

  if (isLoading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Configure platform, business, and notification settings.
            </p>
          </div>
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>

        {/* Platform Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Settings</CardTitle>
            <CardDescription>
              General platform configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="site-name">Site Name</Label>
                <Input
                  id="site-name"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="support-email">Support Email</Label>
                <Input
                  id="support-email"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  All admin notifications will be sent to this email.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="support-phone">Support Phone</Label>
                <Input
                  id="support-phone"
                  type="tel"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Business Settings</CardTitle>
            <CardDescription>
              Currency, tax, and order configuration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min-order">Minimum Order Value ($)</Label>
                <Input
                  id="min-order"
                  type="number"
                  value={minOrderValue}
                  onChange={(e) => setMinOrderValue(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="early-access-limit">Early Access Limit</Label>
                <Input
                  id="early-access-limit"
                  type="number"
                  min="1"
                  value={earlyAccessLimit}
                  onChange={(e) => setEarlyAccessLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Number of customers eligible for early access rewards on new product launches.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Settings</CardTitle>
            <CardDescription>
              Enable or disable platform features for customers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  Quote Requests
                </Label>
                <p className="text-xs text-muted-foreground">
                  Allow customers to request custom quotes on product pages
                  and view their quotes in the dashboard.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={quotesEnabled}
                onClick={() => setQuotesEnabled(!quotesEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  quotesEnabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    quotesEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>
              Control which notifications you receive.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  Email Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive order updates, quote requests, and alerts via email
                  to your support email address.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailNotifications}
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  emailNotifications ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    emailNotifications ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Bottom save button for mobile */}
        <div className="flex justify-end pb-4">
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>
      </div>
    </PageTransition>
  )
}
