import type { SnfRecord } from '../types/facility'
import type { PortfolioMemberResolved } from './portfolioReport'
import { haversineMiles } from './geo'
import { median } from './marketMedians'
import { titleCaseName } from './facilityDisplay'

/**
 * Portfolio summary: each home in a portfolio against the median of the SNFs around it.
 *
 * Every metric here is "higher is better", which is what lets one comparison function serve all
 * five. Nothing is inferred or scored -- a cell is the home's own published value, the median of
 * its neighbours, and the gap between them. There is deliberately no composite number.
 */

export type SummaryMetricKey =
  | 'overallRating'
  | 'staffingRating'
  | 'totalNurseStaffingHprd'
  | 'occupancyPct'
  | 'healthInspectionRating'

export const SUMMARY_METRICS: { key: SummaryMetricKey; label: string; short: string; decimals: number; suffix?: string }[] = [
  { key: 'overallRating', label: 'Overall', short: 'star rating', decimals: 1 },
  { key: 'staffingRating', label: 'Staffing', short: 'staffing rating', decimals: 1 },
  { key: 'totalNurseStaffingHprd', label: 'Nurse HPRD', short: 'nurse staffing', decimals: 2 },
  { key: 'occupancyPct', label: 'Occupancy', short: 'occupancy', decimals: 1, suffix: '%' },
  { key: 'healthInspectionRating', label: 'Inspection', short: 'inspection rating', decimals: 1 }
]

/** Below this many neighbours in the radius, the county median is used instead. */
export const MIN_RADIUS_PEERS = 5

/** A gap this small either way is noise, and is shown grey rather than green or red. */
export const NEUTRAL_BAND_PCT = 2

export type ComparisonBasis = 'radius' | 'county' | 'none'
export type Direction = 'better' | 'worse' | 'same'

export interface MetricCell {
  value: number | null
  median: number | null
  /** Signed percentage gap from the median. Null when either side is missing. */
  deltaPct: number | null
  direction: Direction
}

export interface PortfolioSummaryRow {
  ccn: string
  name: string
  city: string
  state: string
  radiusMiles: number
  basis: ComparisonBasis
  /** How many other SNFs this home was compared against. */
  peerCount: number
  /** County name, when the fallback was used. */
  county: string | null
  metrics: Record<SummaryMetricKey, MetricCell>
}

export interface PortfolioSummaryData {
  rows: PortfolioSummaryRow[]
  headline: string
}

function metricValue(f: SnfRecord, key: SummaryMetricKey): number | null {
  const raw = f[key]
  // `undefined` reaches here from rosters cached before a field was added to the pipeline. It
  // means unknown, exactly like null -- never zero.
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

function compare(value: number | null, med: number | null): MetricCell {
  if (value == null || med == null) return { value, median: med, deltaPct: null, direction: 'same' }
  // A zero median would make a percentage gap meaningless (or infinite), so fall back to comparing
  // the raw numbers; the band is then "exactly equal" rather than +/-2%.
  if (med === 0) {
    return {
      value,
      median: med,
      deltaPct: null,
      direction: value > 0 ? 'better' : value < 0 ? 'worse' : 'same'
    }
  }
  const deltaPct = ((value - med) / Math.abs(med)) * 100
  const direction: Direction =
    Math.abs(deltaPct) <= NEUTRAL_BAND_PCT ? 'same' : deltaPct > 0 ? 'better' : 'worse'
  return { value, median: med, deltaPct, direction }
}

/** SNFs within `radiusMiles` of `home`, excluding `home` itself. */
function peersInRadius(home: SnfRecord, allSnfs: SnfRecord[], radiusMiles: number): SnfRecord[] {
  if (home.latitude == null || home.longitude == null) return []
  const out: SnfRecord[] = []
  for (const f of allSnfs) {
    if (f.ccn === home.ccn) continue
    if (f.latitude == null || f.longitude == null) continue
    if (haversineMiles(home.latitude, home.longitude, f.latitude, f.longitude) <= radiusMiles) out.push(f)
  }
  return out
}

/** SNFs in the same county and state, excluding `home` itself. */
function peersInCounty(home: SnfRecord, allSnfs: SnfRecord[]): SnfRecord[] {
  const county = home.county?.trim().toLowerCase()
  if (!county) return []
  return allSnfs.filter(
    (f) =>
      f.ccn !== home.ccn &&
      f.state === home.state &&
      (f.county?.trim().toLowerCase() ?? '') === county
  )
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

export function buildPortfolioSummary(
  members: PortfolioMemberResolved[],
  allSnfs: SnfRecord[]
): PortfolioSummaryData {
  const rows: PortfolioSummaryRow[] = []

  for (const member of members) {
    // Hospitals are not "homes" and carry none of these metrics, so they are simply not rows.
    if (member.facility.kind !== 'snf') continue
    const home = member.facility
    const radiusMiles = member.row.radiusMiles

    const radiusPeers = peersInRadius(home, allSnfs, radiusMiles)
    let peers = radiusPeers
    let basis: ComparisonBasis = 'radius'
    if (radiusPeers.length < MIN_RADIUS_PEERS) {
      const countyPeers = peersInCounty(home, allSnfs)
      if (countyPeers.length > 0) {
        peers = countyPeers
        basis = 'county'
      } else if (radiusPeers.length === 0) {
        basis = 'none'
      }
    }

    const metrics = {} as Record<SummaryMetricKey, MetricCell>
    for (const { key, decimals } of SUMMARY_METRICS) {
      const values = peers.map((p) => metricValue(p, key)).filter((v): v is number => v != null)
      const med = peers.length > 0 ? median(values) : null
      metrics[key] = compare(metricValue(home, key), med == null ? null : round(med, decimals))
    }

    rows.push({
      ccn: home.ccn,
      name: titleCaseName(home.name),
      city: home.city,
      state: home.state,
      radiusMiles,
      basis,
      peerCount: peers.length,
      county: basis === 'county' ? (home.county ?? null) : null,
      metrics
    })
  }

  return { rows, headline: buildHeadline(rows) }
}

/**
 * The headline, assembled from the rows rather than written by a model.
 *
 * Deliberately two facts and no verdict: how the portfolio sits on staffing, and which home is
 * furthest behind its own area. Homes with no usable comparison are left out of the count rather
 * than being quietly counted as failures.
 */
export function buildHeadline(rows: PortfolioSummaryRow[]): string {
  if (rows.length === 0) return ''

  const comparable = rows.filter(
    (r) => r.metrics.staffingRating.value != null && r.metrics.staffingRating.median != null
  )
  const beating = comparable.filter((r) => r.metrics.staffingRating.direction === 'better')

  const sentences: string[] = []
  if (comparable.length === 0) {
    sentences.push(
      rows.length === 1
        ? 'No staffing comparison is available for this home yet.'
        : 'No staffing comparison is available for these homes yet.'
    )
  } else {
    sentences.push(
      `${beating.length} of ${comparable.length} home${comparable.length === 1 ? '' : 's'} beat their area median on staffing.`
    )
  }

  const worseCount = (r: PortfolioSummaryRow) =>
    SUMMARY_METRICS.filter(({ key }) => r.metrics[key].direction === 'worse').length

  const ranked = [...rows]
    .filter((r) => worseCount(r) > 0)
    .sort((a, b) => {
      const d = worseCount(b) - worseCount(a)
      if (d !== 0) return d
      // Tie-break on the overall rating so the ordering is stable and not array order.
      return (a.metrics.overallRating.value ?? Infinity) - (b.metrics.overallRating.value ?? Infinity)
    })

  const weakest = ranked[0]
  if (weakest) {
    const behind = SUMMARY_METRICS.filter(({ key }) => weakest.metrics[key].direction === 'worse').map(
      (m) => m.short
    )
    sentences.push(`Weakest: ${weakest.name} (${joinList(behind)} below the area).`)
  }

  return sentences.join(' ')
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "vs 14 SNFs within 10 mi", or the county equivalent. */
export function describeComparisonSet(row: PortfolioSummaryRow): string {
  const n = `${row.peerCount} SNF${row.peerCount === 1 ? '' : 's'}`
  if (row.basis === 'county') {
    return row.county ? `vs ${n} in ${row.county} County` : `vs ${n} in this county`
  }
  if (row.basis === 'none') return 'No comparable SNFs nearby'
  return `vs ${n} within ${row.radiusMiles} mi`
}

export function formatMetric(value: number | null, key: SummaryMetricKey): string {
  if (value == null) return '—'
  const spec = SUMMARY_METRICS.find((m) => m.key === key)!
  return `${round(value, spec.decimals)}${spec.suffix ?? ''}`
}
