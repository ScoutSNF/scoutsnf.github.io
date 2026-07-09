import { db, type SavedFacilityRow } from './db'
import type { FacilityKind } from '../types/facility'

function rowId(kind: FacilityKind, ccn: string): string {
  return `${kind}:${ccn}`
}

export async function listSavedFacilities(): Promise<SavedFacilityRow[]> {
  const rows = await db.saved.toArray()
  return rows.sort((a, b) => a.order - b.order)
}

export async function isSaved(kind: FacilityKind, ccn: string): Promise<boolean> {
  return (await db.saved.get(rowId(kind, ccn))) != null
}

export async function saveFacility(input: {
  kind: FacilityKind
  ccn: string
  name: string
  city: string
  state: string
  radiusMiles: number
}): Promise<void> {
  const count = await db.saved.count()
  const row: SavedFacilityRow = {
    id: rowId(input.kind, input.ccn),
    kind: input.kind,
    ccn: input.ccn,
    name: input.name,
    city: input.city,
    state: input.state,
    radiusMiles: input.radiusMiles,
    notes: '',
    savedAt: new Date().toISOString(),
    order: count
  }
  await db.saved.put(row)
}

export async function removeSavedFacility(kind: FacilityKind, ccn: string): Promise<void> {
  await db.saved.delete(rowId(kind, ccn))
}

export async function updateSavedNotes(kind: FacilityKind, ccn: string, notes: string): Promise<void> {
  const row = await db.saved.get(rowId(kind, ccn))
  if (row) await db.saved.put({ ...row, notes })
}

export async function reorderSavedFacilities(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.saved, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      const row = await db.saved.get(orderedIds[i])
      if (row) await db.saved.put({ ...row, order: i })
    }
  })
}
