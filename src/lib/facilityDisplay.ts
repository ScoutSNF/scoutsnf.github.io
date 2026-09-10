import type { FacilityRecord, SnfRecord, SpecialFocusStatus } from '../types/facility'

export interface OccupancyDisplay {
  text: string
  asOfLabel: string | null
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
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
