"use client"

import { useState } from "react"
import { FileText, Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"

import { useUser } from "@/lib/hooks/use-auth"
import { useProfile } from "@/lib/hooks/use-profile"
import { useCreateQuote } from "@/lib/hooks/use-quotes"
import { AuthPromptDialog } from "@/components/shared/auth-prompt-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface RequestQuoteDialogProps {
  productId: string
  productName: string
  packagingSizes: string[]
}

export function RequestQuoteDialog({
  productId,
  productName,
  packagingSizes,
}: RequestQuoteDialogProps) {
  const [open, setOpen] = useState(false)
  const [authPromptOpen, setAuthPromptOpen] = useState(false)
  const { user } = useUser()
  const { data: profile } = useProfile()
  const createQuote = useCreateQuote()

  const [quantity, setQuantity] = useState("100")
  const [packaging, setPackaging] = useState(packagingSizes[0] || "")
  const [delivery, setDelivery] = useState("")
  const [message, setMessage] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")

  // Pre-fill from profile when dialog opens
  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (isOpen && profile) {
      setName(profile.contact_name || "")
      setEmail(profile.email || "")
      setPhone(profile.phone || "")
      setCompany(profile.company_name || "")
      const addr = [
        profile.address_street,
        profile.address_city,
        profile.address_state,
        profile.address_postcode,
      ]
        .filter(Boolean)
        .join(", ")
      setDelivery(profile.delivery_address || addr || "")
    }
  }

  async function handleSubmit() {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required")
      return
    }

    createQuote.mutate(
      {
        product_id: productId,
        product_name: productName,
        quantity: parseInt(quantity) || 1,
        packaging_size: packaging || undefined,
        delivery_location: delivery || undefined,
        message: message || undefined,
        contact_name: name,
        contact_email: email,
        contact_phone: phone || undefined,
        company_name: company || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Quote request submitted!", {
            description:
              "Our team will review your request and get back to you within 1 business day.",
            duration: 8000,
          })
          setOpen(false)
          setMessage("")
          setQuantity("100")
        },
        onError: () => {
          toast.error("Unable to submit your quote request. Please try again or contact support.")
        },
      },
    )
  }

  return (
    <>
    <Button
      variant="outline"
      size="lg"
      className="h-12 flex-1 gap-2 text-base sm:h-11 sm:text-sm"
      onClick={() => {
        if (!user) {
          setAuthPromptOpen(true)
        } else {
          handleOpenChange(true)
        }
      }}
    >
      <FileText className="size-4" />
      Request Quote
    </Button>
    <AuthPromptDialog
      open={authPromptOpen}
      onOpenChange={setAuthPromptOpen}
      title="Sign in to request a quote"
      description="Create an account or sign in to request custom pricing for bulk orders."
    />
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request a Quote</DialogTitle>
          <DialogDescription>
            Get custom pricing for bulk orders of {productName}. We will respond
            within 1 business day.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Product info (read-only) */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium">{productName}</p>
            <p className="text-xs text-muted-foreground">
              Product ID: {productId.slice(0, 8)}...
            </p>
          </div>

          {/* Quantity & Packaging */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quote-qty">Quantity Needed</Label>
              <Input
                id="quote-qty"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quote-packaging">Packaging</Label>
              <Select value={packaging} onValueChange={setPackaging}>
                <SelectTrigger id="quote-packaging">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {packagingSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom / Bulk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Delivery location */}
          <div className="grid gap-2">
            <Label htmlFor="quote-delivery">Delivery Location</Label>
            <Input
              id="quote-delivery"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
              placeholder="e.g. 123 Quarry Rd, Penrith NSW 2750"
            />
          </div>

          {/* Message */}
          <div className="grid gap-2">
            <Label htmlFor="quote-message">
              Additional Details{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <textarea
              id="quote-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Recurring order frequency, special requirements, delivery schedule..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Divider */}
          <div className="border-t pt-2">
            <p className="mb-3 text-sm font-medium">Your Contact Details</p>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quote-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quote-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quote-company">Company</Label>
              <Input
                id="quote-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Pty Ltd"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="quote-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quote-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quote-phone">Phone</Label>
              <Input
                id="quote-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="04XX XXX XXX"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createQuote.isPending}
          >
            {createQuote.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 size-4" />
                Submit Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
