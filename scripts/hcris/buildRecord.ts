import { METRIC_CATALOG, REQUIRED_METRIC_KEYS } from './metricCatalog.js'
import { REPORT_STATUS_LABELS, type FacilityYearRecord, type RawMetricValues, type RptRow } from './types.js'

export interface BuildResult {
  record: FacilityYearRecord | null
  /** Human-readable reasons any field (or the whole record) was dropped -- never silent. */
  warnings: string[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Turns one report's raw extracted cells into a validated FacilityYearRecord. Every field passes
 * its own plausibility range plus the cross-field relationship checks below; anything that fails is
 * dropped (set to null) and logged rather than trusted. A record missing a required metric is
 * dropped entirely.
 */
export function buildFacilityYearRecord(rpt: RptRow, raw: RawMetricValues): BuildResult {
  const warnings: string[] = []
  const ctx = `${rpt.prvdrNum} FY${rpt.fyBeginDate}`

  const inRange = (key: string): number | null => {
    const value = raw[key]
    if (value == null) return null
    const def = METRIC_CATALOG.find((m) => m.key === key)
    if (def?.plausibleRange) {
      const [lo, hi] = def.plausibleRange
      if (value < lo || value > hi) {
        warnings.push(`${ctx}: ${key}=${value} outside plausible range [${lo}, ${hi}] -- dropped`)
        return null
      }
    }
    return value
  }

  for (const key of REQUIRED_METRIC_KEYS) {
    if (inRange(key) == null) {
      warnings.push(`${ctx}: missing required metric ${key} -- record dropped`)
      return { record: null, warnings }
    }
  }

  const bedsAvailable = inRange('bedsAvailable')!
  const totalPatientDays = inRange('totalPatientDays')!
  let bedDaysAvailable = inRange('bedDaysAvailable')
  let medicarePatientDays = inRange('medicarePatientDays')
  let medicaidPatientDays = inRange('medicaidPatientDays')
  let totalPatientRevenue = inRange('totalPatientRevenue')
  let netPatientRevenue = inRange('netPatientRevenue')
  let totalOperatingExpenses = inRange('totalOperatingExpenses')

  // Bed-days available should roughly bound total patient days -- a report period is usually ~365
  // days, so this also catches a bedDaysAvailable cell pointed at the wrong line.
  if (bedDaysAvailable != null && totalPatientDays > bedDaysAvailable * 1.1) {
    warnings.push(`${ctx}: totalPatientDays (${totalPatientDays}) exceeds bedDaysAvailable (${bedDaysAvailable}) -- bedDaysAvailable dropped`)
    bedDaysAvailable = null
  }

  // Medicare + Medicaid days can't exceed total days (the remainder is "other").
  if (medicarePatientDays != null && medicaidPatientDays != null) {
    const sum = medicarePatientDays + medicaidPatientDays
    if (sum > totalPatientDays * 1.02) {
      warnings.push(`${ctx}: medicare+medicaid days (${sum}) exceed total days (${totalPatientDays}) -- payer mix dropped`)
      medicarePatientDays = null
      medicaidPatientDays = null
    }
  }

  // Net patient revenue shouldn't meaningfully exceed gross/total patient revenue.
  if (totalPatientRevenue != null && netPatientRevenue != null && netPatientRevenue > totalPatientRevenue * 1.05) {
    warnings.push(`${ctx}: netPatientRevenue (${netPatientRevenue}) exceeds totalPatientRevenue (${totalPatientRevenue}) -- both dropped`)
    totalPatientRevenue = null
    netPatientRevenue = null
  }

  // Net income = total patient revenue minus total operating expenses -- verified as an exact
  // accounting identity (Worksheet G-3 line 2, negated) against every report in a real HCRIS file,
  // so it's derived here rather than read from its own raw cell.
  const netIncome = totalPatientRevenue != null && totalOperatingExpenses != null ? totalPatientRevenue - totalOperatingExpenses : null

  const occupancyPct = bedDaysAvailable && bedDaysAvailable > 0 ? round1((totalPatientDays / bedDaysAvailable) * 100) : null
  if (occupancyPct != null && (occupancyPct < 0 || occupancyPct > 110)) {
    warnings.push(`${ctx}: computed occupancy ${occupancyPct}% outside plausible 0-110% -- occupancy dropped`)
  }

  const otherPatientDays =
    medicarePatientDays != null && medicaidPatientDays != null ? totalPatientDays - medicarePatientDays - medicaidPatientDays : null

  const payerPct = (days: number | null): number | null =>
    days != null && totalPatientDays > 0 ? round1((days / totalPatientDays) * 100) : null

  const operatingMarginPct =
    netIncome != null && totalPatientRevenue && totalPatientRevenue > 0 ? round1((netIncome / totalPatientRevenue) * 100) : null

  const record: FacilityYearRecord = {
    ccn: rpt.prvdrNum,
    fyBeginDate: rpt.fyBeginDate,
    fyEndDate: rpt.fyEndDate,
    reportStatus: rpt.rptStatusCode,
    reportStatusLabel: REPORT_STATUS_LABELS[rpt.rptStatusCode] ?? 'Unknown',
    processDate: rpt.processDate,
    bedsAvailable,
    totalPatientDays,
    medicarePatientDays,
    medicaidPatientDays,
    otherPatientDays,
    occupancyPct: occupancyPct != null && occupancyPct >= 0 && occupancyPct <= 110 ? occupancyPct : null,
    medicarePct: payerPct(medicarePatientDays),
    medicaidPct: payerPct(medicaidPatientDays),
    otherPct: payerPct(otherPatientDays),
    totalPatientRevenue,
    netPatientRevenue,
    totalOperatingExpenses,
    netIncome,
    operatingMarginPct
  }

  return { record, warnings }
}
