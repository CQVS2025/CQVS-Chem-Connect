"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { toast } from "sonner"

import { useCreateMarketingContact } from "@/lib/hooks/use-marketing-contacts"

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

export default function NewContactPage() {
  const router = useRouter()
  const createContact = useCreateMarketingContact()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [address1, setAddress1] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [tagsRaw, setTagsRaw] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email && !phone) {
      toast.error("Enter at least one of email or phone.")
      return
    }
    try {
      const result = await createContact.mutateAsync({
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company_name: companyName.trim() || undefined,
        address1: address1.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        tags: tagsRaw
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean),
      })
      toast.success("Contact created")
      router.push(`/admin/marketing/contacts/${result.contactId}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed"
      toast.error(message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/marketing/contacts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Add contact</h2>
          <p className="text-sm text-muted-foreground">
            Creates the contact in GoHighLevel and mirrors it locally.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Details</CardTitle>
            <CardDescription>
              Provide at least one of email or phone.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={firstName} onChange={setFirstName} />
            <Field label="Last name" value={lastName} onChange={setLastName} />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
            />
            <Field label="Phone" value={phone} onChange={setPhone} />
            <Field
              label="Company"
              value={companyName}
              onChange={setCompanyName}
            />
            <Field label="City" value={city} onChange={setCity} />
            <Field label="State" value={state} onChange={setState} />
            <Field label="Postal code" value={postalCode} onChange={setPostalCode} />
            <div className="sm:col-span-2">
              <Label className="mb-1.5">Address</Label>
              <Input
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5">Tags</Label>
              <Input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="e.g. vip, qld, lead"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Separate multiple with commas or semicolons.
              </p>
            </div>
            <div className="sm:col-span-2 mt-2 flex items-center gap-2">
              <Button type="submit" disabled={createContact.isPending}>
                {createContact.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Create contact
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/marketing/contacts">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <Label className="mb-1.5">{label}</Label>
      <Input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
