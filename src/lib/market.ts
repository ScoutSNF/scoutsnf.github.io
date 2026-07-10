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

export function statesInResults(
  snfResults: FacilityWithDistance<SnfRecord>[],
  hospitalResults: FacilityWithDistance<HospitalRecord>[]
): string[] {
  const states = new Set<string>()
  for (const r of hospitalResults) if (r.facility.state) states.add(r.facility.state)
  for (const r of snfResults) if (r.facility.state) states.add(r.facility.state)
  return [...states]
}
