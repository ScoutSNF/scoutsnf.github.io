import type { FacilityRecord, SnfRecord, SpecialFocusStatus } from '../types/facility'

export interface OccupancyDisplay {
  text: string
  asOfLabel: string | null
}

function formatShortDate(dateStr: string): string {
  const d = parseDateOnly(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

/**
 * Parses a date-only string (YYYY-MM-DD) in local time rather than UTC.
 *
 * `new Date('2024-12-31')` is specified to parse as UTC midnight, which then reads back as the
 * 30th for every viewer west of UTC. Anything carrying a wall-clock date -- a fiscal year end, a
 * CMS processing date -- has to be built from its parts instead. Full timestamps are left alone.
 */
export function parseDateOnly(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim())
  if (!m) return new Date(dateStr)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function formatDate(dateStr: string): string {
  const d = parseDateOnly(dateStr)
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString()
}

/**
 * The CMS "data as of" date behind a facility's beds, occupancy and star ratings. All three come
 * from the same Care Compare snapshot, so there is one source date, not one per metric. Hospital
 * records carry no equivalent field, so they return null rather than borrowing an unrelated date.
 */
export function getCmsAsOf(facility: FacilityRecord): string | null {
  return facility.kind === 'snf' && facility.processingDate ? facility.processingDate : null
}

/**
 * CMS ships provider names upper-cased. Title-casing them for display keeps the roster readable
 * without touching the stored value, so search (which lower-cases both sides) is unaffected.
 * Small connecting words stay lower except in first position, and tokens that are not plainly
 * words -- initialisms, numerics, anything already mixed-case -- are left exactly as they are.
 */
const LOWER_WORDS = new Set(['of', 'the', 'at', 'and', 'for', 'on', 'in', 'to', 'a', 'an', 'by'])

/**
 * Tokens that stay upper-cased. Mostly corporate suffixes, which read wrong in title case
 * ("Llc"), plus the Roman numerals that appear in campus names ("Building II").
 *
 * This list is deliberately explicit: an earlier version matched these only by accident, because
 * L, L and C all happen to be Roman numerals and so "LLC" fell through a numeral guard. Facility
 * initialisms beyond this list (EAMC, PIH) do get title-cased, which is wrong but harmless, and
 * detecting them in general needs a dictionary this app has no reason to carry.
 */
const KEEP_UPPER = new Set(['LLC', 'LLP', 'LP', 'PC', 'PA', 'LTD', 'DBA', 'VA', 'US', 'USA', 'SNF', 'ICF', 'HHC', 'DP', 'NF'])
const ROMAN = /^(?:[IVXL]{1,6})$/

export function titleCaseName(name: string): string {
  if (!name) return name
  // Already mixed case means a human (or CMS) set it deliberately -- don't second-guess it.
  if (name !== name.toUpperCase()) return name

  const originalTokens = name.split(/(\s+|-|\/)/)

  return name
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((token, i) => {
      if (/^(\s+|-|\/)$/.test(token) || !token) return token
      const original = originalTokens[i] ?? ''
      // Strip trailing punctuation before matching, so "LLC," is still recognised.
      const bare = original.replace(/[^A-Za-z]/g, '')
      if (KEEP_UPPER.has(bare)) return original
      if (ROMAN.test(bare) && bare.length > 1) return original
      if (/\d/.test(token)) return original
      if (i > 0 && LOWER_WORDS.has(token)) return token
      return token.charAt(0).toUpperCase() + token.slice(1)
    })
    .join('')
}

export function getOccupancyDisplay(facility: FacilityRecord): OccupancyDisplay {
  if (facility.occupancyPct == null) return { text: 'N/A', asOfLabel: null }
  const capped = facility.occupancyPct > 100 ? '100%+' : `${facility.occupancyPct}%`
  const asOfLabel =
    facility.kind === 'snf' && facility.processingDate ? `as of ${formatShortDate(facility.processingDate)}` : null
  return { text: capped, asOfLabel }
}

export function getBedsDisplay(facility: FacilityRecord): string {
  return facility.certifiedBeds != null ? String(facility.certifiedBeds) : 'N/A'
}

export const SPECIAL_FOCUS_LABEL: Record<SpecialFocusStatus, { short: string; long: string }> = {
  sff: { short: 'SFF', long: 'Special Focus Facility' },
  candidate: { short: 'SFF cand.', long: 'SFF Candidate' }
}

/**
 * Single reader for Special Focus status, so the legacy-cache fallback lives in one place.
 *
 * A browser holding a roster cached before the SFF/candidate split has only the old
 * `specialFocusFacility` boolean, which cannot distinguish the two. Rather than guess, those
 * records resolve to 'sff' -- the behavior they already had -- and correct themselves the moment
 * that browser fetches a roster published by the current pipeline.
 */
export function getSpecialFocus(facility: SnfRecord): SpecialFocusStatus | null {
  if (facility.specialFocusStatus !== undefined) return facility.specialFocusStatus
  return facility.specialFocusFacility ? 'sff' : null
}

export function googleMapsDirectionsUrl(facility: FacilityRecord): string | null {
  if (facility.latitude == null || facility.longitude == null) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`
}

export function googleSearchUrl(facility: FacilityRecord): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${facility.name} ${facility.city} ${facility.state}`)}`
}
