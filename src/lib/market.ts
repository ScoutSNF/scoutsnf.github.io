import type { FacilityRecord, FacilityWithDistance, SnfRecord, HospitalRecord } from '../types/facility'
import { haversineMiles, roundMile } from './geo'

export function withinRadius<T extends FacilityRecord>(
  anchor: { latitude: number; longitude: number },
  facilities: T[],
  radiusMiles: number,
  excludeCcn?: string
): FacilityWithDistance<T>[] {
  const results: FacilityWithDistance<T>[] = []
  for (const f of facilities) {
    if (excludeCcn && f.ccn === excludeCcn) continue
    if (f.latitude == null || f.longitude == null) continue
    const distanceMiles = roundMile(haversineMiles(anchor.latitude, anchor.longitude, f.latitude, f.longitude))
    if (distanceMiles <= radiusMiles) {
      results.push({ facility: f, distanceMiles })
    }
  }
  results.sort((a, b) => a.distanceMiles - b.distanceMiles)
  return results
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function marketSnapshotLine(snfResults: FacilityWithDistance<SnfRecord>[], radiusMiles: number): string {
  const n = snfResults.length
  if (n === 0) return `No competing SNFs within ${radiusMiles} mi`
  const avgOcc = average(
    snfResults.map((r) => r.facility.occupancyPct).filter((v): v is number => v != null)
  )
  const avgRating = average(
    snfResults.map((r) => r.facility.overallRating).filter((v): v is number => v != null)
  )
  const parts = [`${n} SNF${n === 1 ? '' : 's'} within ${radiusMiles} mi`]
  if (avgOcc != null) parts.push(`avg occupancy ${Math.round(avgOcc)}%`)
  if (avgRating != null) parts.push(`avg rating ${avgRating.toFixed(1)}★`)
  return parts.join(' · ')
}

export function statesInResults(
  snfResults: FacilityWithDistance<SnfRecord>[],
  hospitalResults: FacilityWithDistance<HospitalRecord>[]
): string[] {
  const states = new Set<string>()
  for (const r of hospitalResults) if (r.facility.state) states.add(r.facility.state)
  for (const r of snfResults) if (r.facility.state) states.add(r.facility.state)
  return [...states]
}
