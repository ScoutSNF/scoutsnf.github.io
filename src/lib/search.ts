import type { FacilityRecord, FacilityKind } from '../types/facility'

export interface SearchHit {
  facility: FacilityRecord
  score: number
}

export interface SearchFilters {
  state?: string
  kind?: FacilityKind
  bedsMin?: number
  bedsMax?: number
  /** SNF-only -- ignored (has no effect) when `kind` is 'hospital'. */
  sffOnly?: boolean
}

function norm(s: string): string {
  return s.toLowerCase().trim()
}

function passesFilters(facility: FacilityRecord, filters: SearchFilters): boolean {
  if (filters.state && facility.state !== filters.state) return false
  if (filters.kind && facility.kind !== filters.kind) return false
  if (filters.bedsMin != null && (facility.certifiedBeds == null || facility.certifiedBeds < filters.bedsMin)) return false
  if (filters.bedsMax != null && (facility.certifiedBeds == null || facility.certifiedBeds > filters.bedsMax)) return false
  if (filters.sffOnly && !(facility.kind === 'snf' && facility.specialFocusFacility)) return false
  return true
}

/**
 * Type-ahead over the cached national roster. Free-text query matches name, city, or ZIP (name
 * ranks highest); `filters` narrow by state/kind/bed count/Special Focus Facility and combine
 * with the text query as an AND. Either can drive results alone -- a bare filter set with no
 * text (e.g. "all SNFs in Ohio with 100+ beds") is a valid search on its own.
 */
export function searchFacilities(
  query: string,
  snfs: FacilityRecord[],
  hospitals: FacilityRecord[],
  filters: SearchFilters = {},
  limit = 20
): SearchHit[] {
  const q = norm(query)
  const hasQuery = q.length >= 2
  const hasFilters =
    filters.state != null || filters.kind != null || filters.bedsMin != null || filters.bedsMax != null || filters.sffOnly === true
  if (!hasQuery && !hasFilters) return []

  const all = [...snfs, ...hospitals]
  const hits: SearchHit[] = []

  for (const facility of all) {
    if (!passesFilters(facility, filters)) continue

    let score = hasQuery ? -1 : 1
    if (hasQuery) {
      const name = norm(facility.name)
      const city = norm(facility.city)
      const zip = facility.zip
      if (name.startsWith(q)) score = 100
      else if (name.includes(q)) score = 70
      else if (city.startsWith(q)) score = 50
      else if (city.includes(q)) score = 30
      else if (zip.startsWith(q)) score = 20
    }

    if (score >= 0) hits.push({ facility, score })
  }

  hits.sort((a, b) => b.score - a.score || a.facility.name.localeCompare(b.facility.name))
  return hits.slice(0, limit)
}
