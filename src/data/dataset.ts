import { db, getMeta, setMeta, isStale } from './db'
import { fetchSnfRecords } from './snf'
import { fetchHospitalRecords } from './hospital'
import { fetchHospitalBedCounts } from './pos'
import { geocodeBatch, geocodeSingleNominatim, type GeocodeInput } from './geocode'
import type { SnfRecord, HospitalRecord } from '../types/facility'
import { SourceFetchError } from '../lib/fetchRetry'

export interface LoadResult<T> {
  records: T[]
  fetchedAt: string
  error: string | null
}

const SNF_META_KEY = 'snf'
const HOSPITAL_META_KEY = 'hospital'

/**
 * CMS's own coordinates for a meaningful subset of SNFs turn out to be identical
 * to another, unrelated facility's coordinates (apparent ZIP-centroid fallback in
 * CMS's geocoding rather than a true street-level match — confirmed in production:
 * two different Jamaica, NY facilities both came back as 40.7157,-73.794). Trusting
 * these blindly produces nonsense "0.00 mi apart" results between distinct
 * buildings. Detect any SNFs sharing an exact coordinate with another SNF and
 * re-geocode just that subset via the same Census pipeline used for hospitals,
 * rather than re-geocoding the whole (much larger) SNF roster every time.
 */
function findCoordinateCollisions(records: SnfRecord[]): SnfRecord[] {
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
async function fixCoordinateCollisions(
  records: SnfRecord[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const collided = findCoordinateCollisions(records)
  if (collided.length === 0) return 0

  const inputs: GeocodeInput[] = collided.map((r) => ({
    id: r.ccn,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip
  }))
  const geocoded = await geocodeBatch(inputs, onProgress)
  const misses = inputs.filter((i) => !geocoded.has(i.id))
  for (const miss of misses) {
    const result = await geocodeSingleNominatim(miss)
    if (result) geocoded.set(miss.id, result)
  }

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

/**
 * Lightweight alternative to a full loadSnfData(forceRefresh=true): re-checks the
 * already-cached SNF roster for coordinate collisions without re-downloading the
 * roster itself, and only makes network calls for the facilities that actually
 * collide. Persists corrections back to the cache.
 */
export async function recheckSnfCoordinates(
  onProgress?: (done: number, total: number) => void
): Promise<{ records: SnfRecord[]; checkedCount: number }> {
  const cached = await db.snf.toArray()
  const checkedCount = await fixCoordinateCollisions(cached, onProgress)
  if (checkedCount > 0) {
    await db.transaction('rw', db.snf, async () => {
      await db.snf.clear()
      await db.snf.bulkPut(cached)
    })
  }
  return { records: cached, checkedCount }
}

export async function loadSnfData(
  forceRefresh = false,
  onProgress?: (stage: string, done: number, total: number) => void
): Promise<LoadResult<SnfRecord>> {
  const meta = await getMeta(SNF_META_KEY)
  const cached = await db.snf.toArray()

  if (!forceRefresh && cached.length > 0 && !isStale(meta?.fetchedAt)) {
    return { records: cached, fetchedAt: meta!.fetchedAt, error: null }
  }

  try {
    const fresh = await fetchSnfRecords((attempt, attempts) => onProgress?.('roster-retry', attempt, attempts))
    if (fresh.length === 0) throw new Error('empty response')

    await fixCoordinateCollisions(fresh, (done, total) => onProgress?.('collisions', done, total))

    await db.transaction('rw', db.snf, db.meta, async () => {
      await db.snf.clear()
      await db.snf.bulkPut(fresh)
    })
    await setMeta(SNF_META_KEY)
    return { records: fresh, fetchedAt: new Date().toISOString(), error: null }
  } catch (err) {
    if (cached.length > 0) {
      return { records: cached, fetchedAt: meta?.fetchedAt ?? '', error: null }
    }
    const message = err instanceof SourceFetchError ? err.message : 'SNF roster unavailable — retry'
    return { records: [], fetchedAt: '', error: message }
  }
}

export async function loadHospitalData(
  forceRefresh = false,
  onProgress?: (stage: string, done: number, total: number) => void
): Promise<LoadResult<HospitalRecord>> {
  const meta = await getMeta(HOSPITAL_META_KEY)
  const cached = await db.hospitals.toArray()

  if (!forceRefresh && cached.length > 0 && !isStale(meta?.fetchedAt)) {
    return { records: cached, fetchedAt: meta!.fetchedAt, error: null }
  }

  try {
    const roster = await fetchHospitalRecords((attempt, attempts) => onProgress?.('roster-retry', attempt, attempts))
    if (roster.length === 0) throw new Error('empty response')

    // Reuse previously-geocoded coordinates for facilities we've already resolved, to avoid re-geocoding every refresh.
    const prevByCcn = new Map(cached.map((r) => [r.ccn, r]))
    const needsGeocode: GeocodeInput[] = []
    for (const h of roster) {
      const prev = prevByCcn.get(h.ccn)
      if (prev?.latitude != null && prev?.longitude != null) {
        h.latitude = prev.latitude
        h.longitude = prev.longitude
      } else {
        needsGeocode.push({ id: h.ccn, address: h.address, city: h.city, state: h.state, zip: h.zip })
      }
    }

    if (needsGeocode.length > 0) {
      onProgress?.('geocoding', 0, needsGeocode.length)
      const geocoded = await geocodeBatch(needsGeocode, (done, total) =>
        onProgress?.('geocoding', done, total)
      )
      const misses = needsGeocode.filter((n) => !geocoded.has(n.id))
      for (const miss of misses) {
        const result = await geocodeSingleNominatim(miss)
        if (result) geocoded.set(miss.id, result)
      }
      const byCcn = new Map(roster.map((h) => [h.ccn, h]))
      for (const [ccn, geo] of geocoded) {
        const h = byCcn.get(ccn)
        if (h) {
          h.latitude = geo.latitude
          h.longitude = geo.longitude
        }
      }
    }

    try {
      onProgress?.('beds', 0, 1)
      const beds = await fetchHospitalBedCounts()
      for (const h of roster) {
        const bedCount = beds.get(h.ccn)
        if (bedCount != null) h.certifiedBeds = bedCount
      }
    } catch {
      // bed counts stay null; surfaced as "Not available" in UI rather than failing the whole roster
    }

    await db.transaction('rw', db.hospitals, db.meta, async () => {
      await db.hospitals.clear()
      await db.hospitals.bulkPut(roster)
    })
    await setMeta(HOSPITAL_META_KEY)
    return { records: roster, fetchedAt: new Date().toISOString(), error: null }
  } catch (err) {
    if (cached.length > 0) {
      return { records: cached, fetchedAt: meta?.fetchedAt ?? '', error: null }
    }
    const message = err instanceof SourceFetchError ? err.message : 'Hospital roster unavailable — retry'
    return { records: [], fetchedAt: '', error: message }
  }
}

export async function clearAllCaches(): Promise<void> {
  await db.transaction('rw', db.snf, db.hospitals, db.meta, db.hhsState, async () => {
    await db.snf.clear()
    await db.hospitals.clear()
    await db.meta.clear()
    await db.hhsState.clear()
  })
}
