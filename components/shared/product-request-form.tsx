"use client"

import { useState } from "react"
import { Loader2, CheckCircle, ArrowRight } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { post } from "@/lib/api/client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function ProductRequestForm({ className = "" }: { className?: string }) {
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
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      <Input
        type="text"
        placeholder="e.g. Calcium Chloride, Degreaser, Dust Suppressant..."
        className="h-12 w-full rounded-xl lg:w-[320px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit()
        }}
        disabled={submitRequest.isPending}
      />
      <Button
        size="lg"
        className="h-12 w-full rounded-xl px-7 text-[15px] font-semibold shadow-lg shadow-primary/25 transition-all duration-200 hover:-translate-y-px hover:shadow-xl hover:shadow-primary/35 lg:w-auto"
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
          <>
            Submit Request
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  )
}
