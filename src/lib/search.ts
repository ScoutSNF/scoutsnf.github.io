import type { FacilityRecord, FacilityKind } from '../types/facility'
import { getSpecialFocus } from './facilityDisplay'

/** 'sff' = in the program only; 'candidate' = watch list only; 'any' = either. */
export type SpecialFocusFilter = 'sff' | 'candidate' | 'any'

/**
 * Minimum CMS overall stars, or 'unrated' for facilities CMS has not rated.
 *
 * 'unrated' is a first-class option rather than an afterthought: a facility with no rating is not
 * a 1-star facility, and folding the two together would hide new or recently-certified providers
 * inside the worst band.
 */
export type StarFilter = 1 | 2 | 3 | 4 | 5 | 'unrated'

export interface SearchHit {
  facility: FacilityRecord
  score: number
}

export interface SearchResult {
  /** Ranked matches, capped at `limit`. */
  hits: SearchHit[]
  /** How many matched in total, before the cap -- so truncation is never silent. */
  total: number
}

/**
 * High enough to browse a whole filter-driven result set (the largest today is 441 SFF
 * candidates) rather than just type-ahead's first few, and low enough that a broad text query
 * doesn't render thousands of rows. The list is scrollable, and `total` reports anything cut.
 */
export const DEFAULT_SEARCH_LIMIT = 500

export interface SearchFilters {
  state?: string
  kind?: FacilityKind
  bedsMin?: number
  bedsMax?: number
  /** SNF-only -- ignored (has no effect) when `kind` is 'hospital'. */
  specialFocus?: SpecialFocusFilter
  /** Applies to both kinds, but the two star programs are not the same scale -- see the Legend. */
  minStars?: StarFilter
}

function norm(s: string): string {
  return s.toLowerCase().trim()
}

/**
 * CMS certification numbers are six alphanumeric characters. Matched exactly rather than by
 * prefix so a CCN lookup never competes with ZIP matching: ZIPs are five digits, CCNs six, and
 * an exact-only rule keeps a partially-typed ZIP from silently resolving to some facility's CCN.
 */
const CCN_SHAPED = /^[0-9a-z]{6}$/

export function passesFilters(facility: FacilityRecord, filters: SearchFilters): boolean {
  if (filters.state && facility.state !== filters.state) return false
  if (filters.kind && facility.kind !== filters.kind) return false
  if (filters.bedsMin != null && (facility.certifiedBeds == null || facility.certifiedBeds < filters.bedsMin)) return false
  if (filters.bedsMax != null && (facility.certifiedBeds == null || facility.certifiedBeds > filters.bedsMax)) return false
  if (filters.minStars != null) {
    if (filters.minStars === 'unrated') {
      if (facility.overallRating != null) return false
    } else {
      if (facility.overallRating == null || facility.overallRating < filters.minStars) return false
    }
  }
  if (filters.specialFocus) {
    if (facility.kind !== 'snf') return false
    const status = getSpecialFocus(facility)
    if (status == null) return false
    if (filters.specialFocus !== 'any' && status !== filters.specialFocus) return false
  }
  return true
}

/**
 * Type-ahead over the cached national roster. Free-text query matches an exact CCN, then name,
 * city, or ZIP (an exact CCN ranks above all of them, then name); `filters` narrow by
 * state/kind/bed count/CMS stars/Special Focus status and combine
 * with the text query as an AND. Either can drive results alone -- a bare filter set with no
 * text (e.g. "all SNFs in Ohio with 100+ beds") is a valid search on its own.
 */
export function searchFacilities(
  query: string,
  snfs: FacilityRecord[],
  hospitals: FacilityRecord[],
  filters: SearchFilters = {},
  limit = DEFAULT_SEARCH_LIMIT
): SearchResult {
  const q = norm(query)
  const hasQuery = q.length >= 2
  const hasFilters =
    filters.state != null ||
    filters.kind != null ||
    filters.bedsMin != null ||
    filters.bedsMax != null ||
    filters.specialFocus != null ||
    filters.minStars != null
  if (!hasQuery && !hasFilters) return { hits: [], total: 0 }

  const all = [...snfs, ...hospitals]
  const hits: SearchHit[] = []

  for (const facility of all) {
    if (!passesFilters(facility, filters)) continue

    let score = hasQuery ? -1 : 1
    if (hasQuery) {
      const name = norm(facility.name)
      const city = norm(facility.city)
      const zip = facility.zip
      // An exact CCN is an unambiguous identifier, so it outranks every fuzzy text match.
      if (CCN_SHAPED.test(q) && norm(facility.ccn) === q) score = 200
      else if (name.startsWith(q)) score = 100
      else if (name.includes(q)) score = 70
      else if (city.startsWith(q)) score = 50
      else if (city.includes(q)) score = 30
      else if (zip.startsWith(q)) score = 20
    }

    if (score >= 0) hits.push({ facility, score })
  }

  hits.sort((a, b) => b.score - a.score || a.facility.name.localeCompare(b.facility.name))
  return { hits: hits.slice(0, limit), total: hits.length }
}
