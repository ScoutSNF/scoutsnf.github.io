import type { FacilityRecord, SnfRecord } from '../types/facility'
import type { FacilityYearRecord } from '../types/costReport'
import { getSpecialFocus } from './facilityDisplay'

export interface MedianStat {
  /** Median across the comparison set, or null when too few facilities report the metric. */
  median: number | null
  /** The anchor's own value, when it has one. */
  anchor: number | null
  /** anchor − median, in the metric's own units. Null if either side is missing. */
  delta: number | null
  /** How many facilities in the set actually reported this metric. */
  n: number
}

export interface MarketMedians {
  occupancy: MedianStat
  rating: MedianStat
  medicaidMix: MedianStat
  /** Competitors considered (excludes the anchor itself). */
  competitorCount: number
}

/**
 * Below this, a "median" is a coin flip rather than a market norm, so the UI shows nothing at all
 * instead of a number that invites more confidence than it deserves.
 */
export const MIN_SAMPLE = 4

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function stat(values: number[], anchorValue: number | null): MedianStat {
  const m = values.length >= MIN_SAMPLE ? median(values) : null
  const delta = m != null && anchorValue != null ? round1(anchorValue - m) : null
  return { median: m != null ? round1(m) : null, anchor: anchorValue, delta, n: values.length }
}

/** Latest filed Medicaid share of patient days for a facility, if its cost reports carry one. */
function latestMedicaidPct(records: FacilityYearRecord[] | undefined): number | null {
  if (!records || records.length === 0) return null
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].medicaidPct != null) return records[i].medicaidPct!
  }
  return null
}

/**
 * Medians across the SNFs inside the current radius, with the anchor's own figures alongside.
 *
 * SNF-only on purpose: occupancy, star ratings and Medicaid mix are not comparable between a
 * nursing facility and an acute-care hospital, so mixing them would produce a number that looks
 * authoritative and means nothing. The anchor is excluded from its own comparison set.
 */
export function computeMarketMedians(
  anchor: FacilityRecord,
  competitors: SnfRecord[],
  costReportsByCcn: Map<string, FacilityYearRecord[]>
): MarketMedians {
  const others = competitors.filter((c) => !(c.kind === anchor.kind && c.ccn === anchor.ccn))

  const occupancies = others.map((c) => c.occupancyPct).filter((v): v is number => v != null)
  const ratings = others.map((c) => c.overallRating).filter((v): v is number => v != null)
  const medicaid = others
    .map((c) => latestMedicaidPct(costReportsByCcn.get(c.ccn)))
    .filter((v): v is number => v != null)

  return {
    occupancy: stat(occupancies, anchor.occupancyPct),
    rating: stat(ratings, anchor.overallRating),
    medicaidMix: stat(medicaid, latestMedicaidPct(costReportsByCcn.get(anchor.ccn))),
    competitorCount: others.length
  }
}

export interface Standout {
  text: string
  tone: 'good' | 'bad' | 'neutral'
}

/**
 * One or two plain sentences on how the anchor sits against its local market.
 *
 * Only differences large enough to be worth acting on are reported — a facility one point of
 * occupancy off the median is not a finding. Everything is phrased against the median actually
 * computed above, so nothing here asserts more than the numbers on screen already show.
 */
export function describeStandouts(m: MarketMedians, anchor: FacilityRecord): Standout[] {
  const out: Standout[] = []

  if (m.occupancy.delta != null && Math.abs(m.occupancy.delta) >= 5) {
    const higher = m.occupancy.delta > 0
    out.push({
      text: `Occupancy runs ${Math.abs(m.occupancy.delta)} points ${higher ? 'above' : 'below'} the local median of ${m.occupancy.median}%.`,
      tone: higher ? 'good' : 'bad'
    })
  }

  if (m.rating.delta != null && Math.abs(m.rating.delta) >= 1) {
    const higher = m.rating.delta > 0
    out.push({
      text: `Its CMS overall rating is ${Math.abs(m.rating.delta)} star${Math.abs(m.rating.delta) === 1 ? '' : 's'} ${higher ? 'above' : 'below'} the local median of ${m.rating.median}.`,
      tone: higher ? 'good' : 'bad'
    })
  }

  if (m.medicaidMix.delta != null && Math.abs(m.medicaidMix.delta) >= 8) {
    const higher = m.medicaidMix.delta > 0
    out.push({
      text: `Medicaid is ${Math.abs(m.medicaidMix.delta)} points ${higher ? 'above' : 'below'} the local median of ${m.medicaidMix.median}%, a ${higher ? 'heavier' : 'lighter'} reliance on the lowest-reimbursing payer than its neighbours.`,
      tone: higher ? 'bad' : 'good'
    })
  }

  // Special Focus is worth surfacing here regardless of the medians -- it is the single most
  // consequential thing about a facility and easy to miss among the numbers.
  if (anchor.kind === 'snf') {
    const sff = getSpecialFocus(anchor)
    if (sff === 'sff') {
      out.push({ text: 'It is currently in the CMS Special Focus Facility program.', tone: 'bad' })
    } else if (sff === 'candidate') {
      out.push({ text: 'It is on the CMS Special Focus candidate list.', tone: 'bad' })
    }
  }

  if (out.length === 0 && m.occupancy.median != null) {
    out.push({ text: 'Sits close to the local median on occupancy, rating and payer mix.', tone: 'neutral' })
  }

  return out.slice(0, 3)
}
