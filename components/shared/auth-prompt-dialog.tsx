"use client"

import Link from "next/link"
import { LogIn, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface AuthPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
}

export function AuthPromptDialog({
  open,
  onOpenChange,
  title = "Sign in required",
  description = "You need to sign in or create an account to continue.",
}: AuthPromptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <LogIn className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-balance">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1" asChild>
            <Link href="/login">
              <LogIn className="mr-2 size-4" />
              Sign In
            </Link>
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/register">
              <UserPlus className="mr-2 size-4" />
              Create Account
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
