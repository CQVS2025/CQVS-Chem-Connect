"use client"

import { useEffect, useState } from "react"
import { Building2, MapPin, Save } from "lucide-react"
import { toast } from "sonner"

import { useProfile, useUpdateProfile } from "@/lib/hooks/use-profile"
import { Skeleton } from "@/components/ui/skeleton"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const states = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const

export default function SettingsPage() {
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()

  const [company, setCompany] = useState({
    name: "",
    abn: "",
    contact: "",
    email: "",
    phone: "",
  })

  const [address, setAddress] = useState({
    street: "",
    city: "",
    state: "",
    postcode: "",
    delivery: "",
  })

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setCompany({
        name: profile.company_name || "",
        abn: profile.abn || "",
        contact: profile.contact_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
      })
      setAddress({
        street: profile.address_street || "",
        city: profile.address_city || "",
        state: profile.address_state || "",
        postcode: profile.address_postcode || "",
        delivery: profile.delivery_address || "",
      })
    }
  }, [profile])

  function handleSave() {
    updateProfile.mutate(
      {
        company_name: company.name || null,
        abn: company.abn || null,
        contact_name: company.contact || null,
        phone: company.phone || null,
        address_street: address.street || null,
        address_city: address.city || null,
        address_state: address.state || null,
        address_postcode: address.postcode || null,
        delivery_address: address.delivery || null,
      },
      {
        onSuccess: () => {
          toast.success("Settings saved successfully", {
            description:
              "Your company profile and delivery address have been updated.",
          })
        },
        onError: (err) => {
          toast.error("Failed to save settings", {
            description: err.message,
          })
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-60" />
          <Skeleton className="mt-2 h-5 w-80" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your company profile and delivery preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Your business details for invoicing and compliance.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={company.name}
                  onChange={(e) =>
                    setCompany({ ...company, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="abn">ABN</Label>
                <Input
                  id="abn"
                  value={company.abn}
                  onChange={(e) =>
                    setCompany({ ...company, abn: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-name">Contact Name</Label>
                <Input
                  id="contact-name"
                  value={company.contact}
                  onChange={(e) =>
                    setCompany({ ...company, contact: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={company.email}
                  disabled
                  className="opacity-60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={company.phone}
                  onChange={(e) =>
                    setCompany({ ...company, phone: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Delivery Address</CardTitle>
                <CardDescription>
                  Default shipping address for your orders.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={address.street}
                  onChange={(e) =>
                    setAddress({ ...address, street: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City / Suburb</Label>
                <Input
                  id="city"
                  value={address.city}
                  onChange={(e) =>
                    setAddress({ ...address, city: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={address.state}
                    onValueChange={(val) =>
                      setAddress({ ...address, state: val })
                    }
                  >
                    <SelectTrigger id="state" className="w-full">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input
                    id="postcode"
                    value={address.postcode}
                    onChange={(e) =>
                      setAddress({ ...address, postcode: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery">
                  Separate Delivery Location{" "}
                  <span className="text-xs text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="delivery"
                  value={address.delivery}
                  placeholder="Leave blank to use business address above"
                  onChange={(e) =>
                    setAddress({ ...address, delivery: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleSave}
          disabled={updateProfile.isPending}
        >
          <Save className="mr-1.5 h-4 w-4" />
          {updateProfile.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
