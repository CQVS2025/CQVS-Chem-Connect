// Postcode → road distance lookup, with caching.
//
// Production: Google Distance Matrix API. We cache the result keyed by
// (origin_postcode, destination_postcode) for the order's lifetime so a
// single checkout never burns more than one Distance Matrix call per
// (origin, destination) pair.
//
// Falls back to an offline approximation (haversine over postcode
// centroids) when GOOGLE_DISTANCE_MATRIX_API_KEY is not configured —
// useful for local dev and tests.

import postcodeCentroids from "./postcode-centroids.json"

interface CentroidMap { [postcode: string]: { lat: number; lng: number } }

const centroids = postcodeCentroids as unknown as CentroidMap

const memCache = new Map<string, number>()

function cacheKey(origin: string, destination: string): string {
  return `${origin}::${destination}`
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function approximateDistanceKm(
  originPostcode: string,
  destinationPostcode: string,
): number | null {
  const o = centroids[originPostcode]
  const d = centroids[destinationPostcode]
  if (!o || !d) return null
  // Road distance is ~1.25× straight-line on average across AU.
  return haversineKm(o, d) * 1.25
}

async function googleDistanceMatrixKm(
  origin: string,
  destination: string,
): Promise<number | null> {
  const key = process.env.GOOGLE_DISTANCE_MATRIX_API_KEY
  if (!key) return null

  const url = new URL(
    "https://maps.googleapis.com/maps/api/distancematrix/json",
  )
  url.searchParams.set("origins", `${origin}, AU`)
  url.searchParams.set("destinations", `${destination}, AU`)
  url.searchParams.set("units", "metric")
  url.searchParams.set("key", key)

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const json = (await res.json()) as {
      rows?: Array<{
        elements?: Array<{ status: string; distance?: { value: number } }>
      }>
    }
    const meters = json.rows?.[0]?.elements?.[0]?.distance?.value
    if (typeof meters !== "number") return null
    return meters / 1000
  } catch (err) {
    console.error("[distance] Google Distance Matrix failed:", err)
    return null
  }
}

/**
 * Returns road distance in kilometres between two AU postcodes.
 *
 * Tries Google Distance Matrix first; falls back to a haversine
 * approximation when the API isn't configured or fails. Returns null
 * if both methods fail (caller decides what to do).
 */
export async function getRoadDistanceKm(
  originPostcode: string,
  destinationPostcode: string,
): Promise<number | null> {
  if (!originPostcode || !destinationPostcode) return null
  if (originPostcode === destinationPostcode) return 0

  const key = cacheKey(originPostcode, destinationPostcode)
  if (memCache.has(key)) return memCache.get(key)!

  const km =
    (await googleDistanceMatrixKm(originPostcode, destinationPostcode)) ??
    approximateDistanceKm(originPostcode, destinationPostcode)

  if (km !== null) memCache.set(key, km)
  return km
}

/**
 * Round km up to the next 100km bracket boundary.
 *   350 -> 400, 100 -> 100, 101 -> 200.
 */
export function roundUpToBracketKm(km: number, stepKm = 100): number {
  if (km <= 0) return stepKm
  return Math.ceil(km / stepKm) * stepKm
}
