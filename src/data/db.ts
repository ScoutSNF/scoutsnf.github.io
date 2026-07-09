import Dexie, { type Table } from 'dexie'
import type { SnfRecord, HospitalRecord, SavedFacility } from '../types/facility'
import type { HospitalOccupancy } from './hhsOccupancy'

export interface MetaRow {
  key: string
  fetchedAt: string
}

export interface HhsStateCacheRow {
  state: string
  fetchedAt: string
  data: Record<string, HospitalOccupancy>
}

export interface PlacesCacheRow {
  ccn: string
  website: string | null
  photoUrl: string | null
  fetchedAt: string
}

export interface SavedFacilityRow extends SavedFacility {
  id: string // `${kind}:${ccn}`
}

class MarketRadiusDb extends Dexie {
  snf!: Table<SnfRecord, string>
  hospitals!: Table<HospitalRecord, string>
  meta!: Table<MetaRow, string>
  hhsState!: Table<HhsStateCacheRow, string>
  places!: Table<PlacesCacheRow, string>
  saved!: Table<SavedFacilityRow, string>

  constructor() {
    super('scoutsnf')
    this.version(1).stores({
      snf: 'ccn, state',
      hospitals: 'ccn, state',
      meta: 'key',
      hhsState: 'state',
      places: 'ccn',
      saved: 'id, order'
    })
  }
}

export const db = new MarketRadiusDb()

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function getMeta(key: string): Promise<MetaRow | undefined> {
  return db.meta.get(key)
}

export async function setMeta(key: string): Promise<void> {
  await db.meta.put({ key, fetchedAt: new Date().toISOString() })
}

export function isStale(fetchedAt: string | undefined, maxAgeMs = SEVEN_DAYS_MS): boolean {
  if (!fetchedAt) return true
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs
}
