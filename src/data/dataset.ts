import { db, getMeta, setMeta, isStale } from './db'
import { fetchWithRetry, SourceFetchError } from '../lib/fetchRetry'
import type { SnfRecord, HospitalRecord } from '../types/facility'

export interface LoadResult<T> {
  records: T[]
  fetchedAt: string
  error: string | null
}

const SNF_META_KEY = 'snf'
const HOSPITAL_META_KEY = 'hospital'
export const SNF_ROSTER_ERROR_KEY = 'scoutsnf:snfRosterError'
export const HOSPITAL_ROSTER_ERROR_KEY = 'scoutsnf:hospitalRosterError'

export interface RosterManifest {
  built_at: string
  snf: { count: number; source_dataset_id: string }
  hospital: {
    count: number
    source_dataset_id: string
    source_bed_dataset_id: string
    bedCounts: { matched: number; total: number; error: string | null }
  }
}

function rosterErrorMessage(err: unknown, fallback: string): string {
  return err instanceof SourceFetchError || err instanceof Error ? err.message : fallback
}

/**
 * CMS's own coordinates for a meaningful subset of SNFs turn out to be identical to another,
 * unrelated facility's coordinates (apparent ZIP-centroid fallback in CMS's geocoding rather than
 * a true street-level match -- confirmed in production: two different Jamaica, NY facilities both
 * came back as 40.7157,-73.794). This only groups already-loaded records in memory -- no network
 * call, no geocoding. The actual fix now happens upstream in the scripts/roster/ CI pipeline
 * (scripts/roster/fixCollisions.ts); this is purely a read-only check the browser can still run.
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

/**
 * "Re-check facility locations": pulls the latest published SNF roster (already corrected
 * upstream by the weekly pipeline, including any collision fixes) and reports how many
 * facilities still share a location with another. No geocoding happens here or anywhere in the
 * browser -- if collisions remain, the actual fix ships on the pipeline's next run, not from this
 * click. Falls back to whatever's cached if the origin fetch fails, so the check still means
 * something (against slightly older data) rather than erroring out.
 */
export async function recheckSnfCoordinates(): Promise<{ collisionCount: number; checkedAgainstLatest: boolean }> {
  try {
    const fresh = await fetchRosterJson<SnfRecord>('snf-roster.json', 'SNF roster')
    if (fresh.length > 0) {
      await db.transaction('rw', db.snf, db.meta, async () => {
        await db.snf.clear()
        await db.snf.bulkPut(fresh)
      })
      await setMeta(SNF_META_KEY)
      return { collisionCount: findCoordinateCollisions(fresh).length, checkedAgainstLatest: true }
    }
  } catch {
    // fall through to whatever's cached
  }
  const cached = await db.snf.toArray()
  return { collisionCount: findCoordinateCollisions(cached).length, checkedAgainstLatest: false }
}

/**
 * Fetches a roster artifact published by the scripts/roster/ CI pipeline (roster-pipeline.yml) --
 * same-origin static JSON, not a live CMS/geocoder call. Coordinates, bed counts, and the SNF
 * coordinate-collision fix are already baked in by the time this file exists; the browser never
 * geocodes anything itself.
 */
async function fetchRosterJson<T>(filename: string, label: string, onRetry?: (attempt: number, attempts: number) => void): Promise<T[]> {
  const res = await fetchWithRetry(`${import.meta.env.BASE_URL}data/${filename}`, label, undefined, { onRetry })
  return (await res.json()) as T[]
}

export async function loadSnfData(
  forceRefresh = false,
  onRetry?: (attempt: number, attempts: number) => void
): Promise<LoadResult<SnfRecord>> {
  const meta = await getMeta(SNF_META_KEY)
  const cached = await db.snf.toArray()

  if (!forceRefresh && cached.length > 0 && !isStale(meta?.fetchedAt)) {
    return { records: cached, fetchedAt: meta!.fetchedAt, error: null }
  }

  try {
    const fresh = await fetchRosterJson<SnfRecord>('snf-roster.json', 'SNF roster', onRetry)
    if (fresh.length === 0) throw new Error('empty response')

    await db.transaction('rw', db.snf, db.meta, async () => {
      await db.snf.clear()
      await db.snf.bulkPut(fresh)
    })
    await setMeta(SNF_META_KEY)
    localStorage.removeItem(SNF_ROSTER_ERROR_KEY)
    return { records: fresh, fetchedAt: new Date().toISOString(), error: null }
  } catch (err) {
    const message = rosterErrorMessage(err, 'SNF roster unavailable — retry')
    if (cached.length > 0) {
      // Falling back to cache hides this from the user everywhere except Settings --
      // without it, a refresh that silently fails looks identical to one that succeeded.
      localStorage.setItem(SNF_ROSTER_ERROR_KEY, `${new Date().toLocaleString()} — ${message}`)
      return { records: cached, fetchedAt: meta?.fetchedAt ?? '', error: null }
    }
    return { records: [], fetchedAt: '', error: message }
  }
}

export async function loadHospitalData(
  forceRefresh = false,
  onRetry?: (attempt: number, attempts: number) => void
): Promise<LoadResult<HospitalRecord>> {
  const meta = await getMeta(HOSPITAL_META_KEY)
  const cached = await db.hospitals.toArray()

  if (!forceRefresh && cached.length > 0 && !isStale(meta?.fetchedAt)) {
    return { records: cached, fetchedAt: meta!.fetchedAt, error: null }
  }

  try {
    const fresh = await fetchRosterJson<HospitalRecord>('hospital-roster.json', 'Hospital roster', onRetry)
    if (fresh.length === 0) throw new Error('empty response')

    await db.transaction('rw', db.hospitals, db.meta, async () => {
      await db.hospitals.clear()
      await db.hospitals.bulkPut(fresh)
    })
    await setMeta(HOSPITAL_META_KEY)
    localStorage.removeItem(HOSPITAL_ROSTER_ERROR_KEY)
    return { records: fresh, fetchedAt: new Date().toISOString(), error: null }
  } catch (err) {
    const message = rosterErrorMessage(err, 'Hospital roster unavailable — retry')
    if (cached.length > 0) {
      localStorage.setItem(HOSPITAL_ROSTER_ERROR_KEY, `${new Date().toLocaleString()} — ${message}`)
      return { records: cached, fetchedAt: meta?.fetchedAt ?? '', error: null }
    }
    return { records: [], fetchedAt: '', error: message }
  }
}

/** Best-effort fetch of the CI pipeline's build manifest, for the Settings freshness badge. Never
 * blocks or fails app load -- returns null on any error, including before the pipeline's first run. */
export async function loadRosterManifest(): Promise<RosterManifest | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/roster-manifest.json`)
    if (!res.ok) return null
    return (await res.json()) as RosterManifest
  } catch {
    return null
  }
}

/** Reads whatever's cached without triggering any network fetch -- lets the caller show
 * existing data immediately and decide separately whether a refresh is warranted. */
export async function getCachedSnf(): Promise<{ records: SnfRecord[]; fetchedAt: string }> {
  const [meta, records] = await Promise.all([getMeta(SNF_META_KEY), db.snf.toArray()])
  return { records, fetchedAt: meta?.fetchedAt ?? '' }
}

export async function getCachedHospitals(): Promise<{ records: HospitalRecord[]; fetchedAt: string }> {
  const [meta, records] = await Promise.all([getMeta(HOSPITAL_META_KEY), db.hospitals.toArray()])
  return { records, fetchedAt: meta?.fetchedAt ?? '' }
}

export async function clearAllCaches(): Promise<void> {
  await db.transaction('rw', db.snf, db.hospitals, db.meta, async () => {
    await db.snf.clear()
    await db.hospitals.clear()
    await db.meta.clear()
  })
}
