import type { FacilityRecord } from '../types/facility'

export interface OccupancyDisplay {
  text: string
  asOfLabel: string | null
  /** Hospital occupancy is from a frozen 2024 dataset — style it as historical/muted. */
  historical: boolean
}

function formatWeekOf(dateStr: string): string {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return `wk of ${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
}

export function getOccupancyDisplay(facility: FacilityRecord): OccupancyDisplay {
  if (facility.kind === 'snf') {
    if (facility.occupancyPct == null) return { text: 'N/A', asOfLabel: null, historical: false }
    const capped = facility.occupancyPct > 100 ? '100%+' : `${facility.occupancyPct}%`
    return {
      text: capped,
      asOfLabel: facility.processingDate ? `as of ${facility.processingDate}` : null,
      historical: false
    }
  }
  if (facility.occupancyPct == null) {
    return { text: 'N/A', asOfLabel: facility.occupancyAsOfWeek ? formatWeekOf(facility.occupancyAsOfWeek) : null, historical: true }
  }
  return {
    text: `${facility.occupancyPct}%`,
    asOfLabel: facility.occupancyAsOfWeek ? formatWeekOf(facility.occupancyAsOfWeek) : null,
    historical: true
  }
}

export function getBedsDisplay(facility: FacilityRecord): string {
  return facility.certifiedBeds != null ? String(facility.certifiedBeds) : 'N/A'
}

export function googleMapsDirectionsUrl(facility: FacilityRecord): string | null {
  if (facility.latitude == null || facility.longitude == null) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`
}

export function googleSearchUrl(facility: FacilityRecord): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${facility.name} ${facility.city} ${facility.state}`)}`
}
