import type { FacilityRecord, FacilityWithDistance } from '../types/facility'
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
