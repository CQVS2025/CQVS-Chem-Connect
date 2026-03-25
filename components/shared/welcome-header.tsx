"use client"

import { useProfile } from "@/lib/hooks/use-profile"
import { Skeleton } from "@/components/ui/skeleton"

export function WelcomeHeader() {
  const { data: profile, isLoading } = useProfile()

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-5 w-48" />
      </div>
    )
  }

  const firstName = profile?.contact_name?.split(" ")[0] || "there"

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome back, {firstName}
      </h1>
      {profile?.company_name && (
        <p className="mt-1 text-muted-foreground">{profile.company_name}</p>
      )}
    </div>
  )
}
