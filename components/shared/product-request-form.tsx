"use client"

import { useState } from "react"
import { Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ProductRequestForm() {
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    if (!value.trim()) {
      toast.error("Please enter a product name or description.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/product-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: value.trim() }),
      })

      if (!res.ok) {
        toast.error("Unable to submit your request. Please try again.")
        return
      }

      setSent(true)
      toast.success("Request submitted! Our team will look into it.")
      setValue("")

      // Reset after 5 seconds
      setTimeout(() => setSent(false), 5000)
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Input
        type="text"
        placeholder="e.g. Calcium Chloride, Degreaser, Dust Suppressant..."
        className="h-11 flex-1 rounded-xl"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit()
        }}
        disabled={loading}
      />
      <Button
        size="lg"
        className="rounded-xl shadow-primary/25 shadow-md"
        onClick={handleSubmit}
        disabled={loading || sent}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : sent ? (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            Submitted
          </>
        ) : (
          "Submit Request"
        )}
      </Button>
    </div>
  )
}
