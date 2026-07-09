import { HHS_CAPACITY_URL, HHS_SENTINEL_SUPPRESSED } from './sources'
import { fetchWithRetry } from '../lib/fetchRetry'

export interface HospitalOccupancy {
  occupancyPct: number | null
  asOfWeek: string | null
}

interface HhsRow {
  hospital_pk: string
  collection_week: string
  inpatient_beds_7_day_avg?: string | number
  inpatient_beds_used_7_day_avg?: string | number
}

function isSuppressed(v: string | number | undefined): boolean {
  if (v == null) return true
  return Number(v) === HHS_SENTINEL_SUPPRESSED
}

/** Fetches the most recent occupancy row per hospital for a single state from the (frozen, May 2024) HHS file. */
export async function fetchHospitalOccupancyForState(
  stateAbbr: string
): Promise<Map<string, HospitalOccupancy>> {
  const soql =
    `$select=hospital_pk,collection_week,inpatient_beds_7_day_avg,inpatient_beds_used_7_day_avg` +
    `&$where=state='${stateAbbr}'` +
    `&$order=collection_week DESC` +
    `&$limit=50000`
  const res = await fetchWithRetry(HHS_CAPACITY_URL(soql), 'Hospital occupancy data')
  const rows = (await res.json()) as HhsRow[]

  const result = new Map<string, HospitalOccupancy>()
  for (const row of rows) {
    if (result.has(row.hospital_pk)) continue // already have the most recent (rows ordered DESC)
    const beds = row.inpatient_beds_7_day_avg
    const used = row.inpatient_beds_used_7_day_avg
    if (isSuppressed(beds) || isSuppressed(used) || Number(beds) === 0) {
      result.set(row.hospital_pk, { occupancyPct: null, asOfWeek: row.collection_week })
      continue
    }
    const pct = Math.round((Number(used) / Number(beds)) * 1000) / 10
    result.set(row.hospital_pk, { occupancyPct: pct, asOfWeek: row.collection_week })
  }
  return result
}

export async function fetchHospitalOccupancyForStates(
  states: string[]
): Promise<Map<string, HospitalOccupancy>> {
  const merged = new Map<string, HospitalOccupancy>()
  const results = await Promise.allSettled(states.map((s) => fetchHospitalOccupancyForState(s)))
  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      for (const [k, v] of r.value) merged.set(k, v)
    }
  })
  return merged
}
