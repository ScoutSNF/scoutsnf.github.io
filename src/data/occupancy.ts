import { db, isStale } from './db'
import { fetchHospitalOccupancyForState, type HospitalOccupancy } from './hhsOccupancy'

/** Loads HHS occupancy for the given states, on demand, caching per-state (this dataset is frozen — cache long). */
export async function loadOccupancyForStates(
  states: string[]
): Promise<Map<string, HospitalOccupancy>> {
  const merged = new Map<string, HospitalOccupancy>()
  const uniqueStates = [...new Set(states.filter(Boolean))]

  await Promise.all(
    uniqueStates.map(async (state) => {
      const cached = await db.hhsState.get(state)
      if (cached && !isStale(cached.fetchedAt, 30 * 24 * 60 * 60 * 1000)) {
        for (const [k, v] of Object.entries(cached.data)) merged.set(k, v)
        return
      }
      try {
        const fresh = await fetchHospitalOccupancyForState(state)
        const data: Record<string, HospitalOccupancy> = {}
        for (const [k, v] of fresh) {
          data[k] = v
          merged.set(k, v)
        }
        await db.hhsState.put({ state, fetchedAt: new Date().toISOString(), data })
      } catch {
        if (cached) {
          for (const [k, v] of Object.entries(cached.data)) merged.set(k, v)
        }
      }
    })
  )

  return merged
}
