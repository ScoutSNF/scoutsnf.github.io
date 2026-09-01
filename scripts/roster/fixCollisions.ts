import type { SnfRecord } from './types.js'
import type { GeocodeInput } from './geocode.js'
import { resolveCoordinatesWithCache, type GeocodeCache } from './geocodeCache.js'

/**
 * CMS's own coordinates for a meaningful subset of SNFs turn out to be identical to another,
 * unrelated facility's coordinates (apparent ZIP-centroid fallback in CMS's geocoding rather than
 * a true street-level match -- confirmed in production against real facility data, e.g. two
 * different Jamaica, NY facilities both came back as 40.7157,-73.794). Port of
 * src/data/dataset.ts's findCoordinateCollisions, unchanged logic.
 */
export function findCoordinateCollisions(records: SnfRecord[]): SnfRecord[] {
  const groups = new Map<string, SnfRecord[]>()
  for (const r of records) {
    if (r.latitude == null || r.longitude == null) continue
    const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`
    const group = groups.get(key)
    if (group) group.push(r)
    else groups.set(key, [r])
  }
  const collided: SnfRecord[] = []
  for (const group of groups.values()) {
    if (group.length > 1) collided.push(...group)
  }
  return collided
}

/** Mutates any colliding records in place with corrected coordinates. Returns how many were found. */
export async function fixCoordinateCollisions(records: SnfRecord[], cache: GeocodeCache): Promise<number> {
  const collided = findCoordinateCollisions(records)
  if (collided.length === 0) return 0

  const inputs: GeocodeInput[] = collided.map((r) => ({ id: r.ccn, address: r.address, city: r.city, state: r.state, zip: r.zip }))
  const geocoded = await resolveCoordinatesWithCache(inputs, cache, (stage, done, total) =>
    console.log(`  collision fix (${stage}): ${done}/${total}`)
  )

  const byCcn = new Map(records.map((r) => [r.ccn, r]))
  for (const [ccn, geo] of geocoded) {
    const r = byCcn.get(ccn)
    if (r) {
      r.latitude = geo.latitude
      r.longitude = geo.longitude
    }
  }
  return collided.length
}
