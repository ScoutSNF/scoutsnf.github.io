import type { FacilityKind } from '../types/facility'

/**
 * Recently opened facilities, so returning to Search is not a blank page.
 *
 * Deliberately stores only what is needed to render a row and re-open it — kind, CCN, name, city,
 * state — all of which are public CMS fields. No notes, no portfolio membership, no identity.
 *
 * Kept in localStorage under the existing `scoutsnf.` namespace so the access gate's version flush
 * clears it along with everything else; recents are session history, not a display preference, and
 * should not outlive a forced re-signin.
 */
export interface RecentFacility {
  id: string
  kind: FacilityKind
  ccn: string
  name: string
  city: string
  state: string
  openedAt: string
}

export const RECENTS_KEY = 'scoutsnf.recentFacilities'
export const MAX_RECENTS = 6

export function readRecents(): RecentFacility[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is RecentFacility =>
        !!r &&
        typeof r === 'object' &&
        typeof (r as RecentFacility).id === 'string' &&
        typeof (r as RecentFacility).ccn === 'string' &&
        typeof (r as RecentFacility).name === 'string'
    )
  } catch {
    // Corrupt JSON, private mode, or blocked site data. Recents are a convenience; failing to read
    // them must never stop Search from rendering.
    return []
  }
}

/** Most recent first, de-duplicated by facility, capped. Returns the new list so callers can
 *  update state without a second read. */
export function recordRecent(facility: {
  kind: FacilityKind
  ccn: string
  name: string
  city: string
  state: string
}): RecentFacility[] {
  const id = `${facility.kind}:${facility.ccn}`
  const entry: RecentFacility = {
    id,
    kind: facility.kind,
    ccn: facility.ccn,
    name: facility.name,
    city: facility.city,
    state: facility.state,
    openedAt: new Date().toISOString()
  }
  const next = [entry, ...readRecents().filter((r) => r.id !== id)].slice(0, MAX_RECENTS)
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    // Quota or blocked storage -- the in-memory list still updates for this session.
  }
  return next
}

export function clearRecents(): RecentFacility[] {
  try {
    localStorage.removeItem(RECENTS_KEY)
  } catch {
    // nothing to do
  }
  return []
}
