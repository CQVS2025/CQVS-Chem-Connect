"use client"

import { useState } from "react"
import { Loader2, CheckCircle } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { post } from "@/lib/api/client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ProductRequestForm() {
  const [value, setValue] = useState("")
  const [sent, setSent] = useState(false)

  const submitRequest = useMutation({
    mutationFn: (request: string) =>
      post("/product-request", { request }),
    onSuccess: () => {
      setSent(true)
      toast.success("Request submitted! Our team will look into it.")
      setValue("")
      setTimeout(() => setSent(false), 5000)
    },
    onError: () => {
      toast.error("Unable to submit your request. Please try again.")
    },
  })

  function handleSubmit() {
    if (!value.trim()) {
      toast.error("Please enter a product name or description.")
      return
    }
    submitRequest.mutate(value.trim())
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
        disabled={submitRequest.isPending}
      />
      <Button
        size="lg"
        className="rounded-xl shadow-primary/25 shadow-md"
        onClick={handleSubmit}
        disabled={submitRequest.isPending || sent}
      >
        {submitRequest.isPending ? (
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
