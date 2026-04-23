/**
 * GoHighLevel Locations API wrapper.
 *
 * Single endpoint used for health checks and surfacing the sub-account's
 * own metadata (timezone, company ID, phone, email).
 */

import { ghlFetch } from "./client"
import { getGhlConfig } from "./config"
import type { GhlLocation } from "./types"

interface GhlLocationResponse {
  location: GhlLocation
}

export async function getLocation(
  locationId: string = getGhlConfig().locationId,
): Promise<GhlLocation> {
  const data = await ghlFetch<GhlLocationResponse | GhlLocation>(
    `/locations/${locationId}`,
  )
  // GHL has returned both shapes historically — normalise.
  if ("location" in (data as GhlLocationResponse)) {
    return (data as GhlLocationResponse).location
  }
  return data as GhlLocation
}

export async function pingLocation(): Promise<{
  ok: true
  location: GhlLocation
}> {
  const location = await getLocation()
  return { ok: true, location }
}
