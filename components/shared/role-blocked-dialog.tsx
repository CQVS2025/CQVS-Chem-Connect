"use client"

import Link from "next/link"
import { ShieldAlert, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface RoleBlockedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: "admin" | "supplier"
}

// Shown when an admin or supplier user tries to perform a customer-only
// action (e.g. add to cart). They cannot mix accounts on the same email,
// so the path forward is to sign up for a separate customer account using
// a different email address.
export function RoleBlockedDialog({
  open,
  onOpenChange,
  role,
}: RoleBlockedDialogProps) {
  const roleLabel = role === "admin" ? "admin" : "supplier"
  const description =
    role === "admin"
      ? "Ordering is for customer accounts only. You are signed in as an admin. To place an order, sign out and create a customer account using a different email address."
      : "Ordering is for customer accounts only. You are signed in as a supplier. To place an order, sign out and create a customer account using a different email address. Buyer and supplier accounts cannot share the same email."

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <ShieldAlert className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-xl">
            {roleLabel === "admin"
              ? "Admins cannot purchase"
              : "Suppliers cannot purchase"}
          </DialogTitle>
          <DialogDescription className="text-balance">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/api/auth/sign-out" prefetch={false}>
              Sign out
            </Link>
          </Button>
          <Button className="flex-1" asChild>
            <Link href="/register">
              <UserPlus className="mr-2 size-4" />
              Create customer account
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
