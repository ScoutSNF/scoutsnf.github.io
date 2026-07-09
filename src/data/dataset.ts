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

export async function loadSnfData(forceRefresh = false): Promise<LoadResult<SnfRecord>> {
  const meta = await getMeta(SNF_META_KEY)
  const cached = await db.snf.toArray()

  if (!forceRefresh && cached.length > 0 && !isStale(meta?.fetchedAt)) {
    return { records: cached, fetchedAt: meta!.fetchedAt, error: null }
  }

  try {
    const fresh = await fetchSnfRecords()
    if (fresh.length === 0) throw new Error('empty response')
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
    const roster = await fetchHospitalRecords()
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
