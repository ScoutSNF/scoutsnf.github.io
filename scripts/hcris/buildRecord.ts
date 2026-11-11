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
 * Case-mix-free display casing for a filer's ALL-CAPS "specify" label ("PROVISION FOR INCOME
 * TAXES" -> "Provision for income taxes"). Acronyms are not restored -- the label is the filer's
 * own text, kept verbatim apart from casing.
 */
function titleCaseLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase()
}

/**
 * Turns one report's raw extracted cells into a validated FacilityYearRecord. Every field passes
 * its own plausibility range plus the cross-field relationship checks below; anything that fails is
 * dropped (set to null) and logged rather than trusted. A record missing a required metric is
 * dropped entirely.
 *
 * `alphaLabels` maps Worksheet G-3 line numbers ("02700".."03000") to the filer's itemized
 * other-expenses labels for this report, when the ALPHA file was parsed.
 */
export function buildFacilityYearRecord(
  rpt: RptRow,
  raw: RawMetricValues,
  alphaLabels?: Map<string, string>
): BuildResult {
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
  let contractualAllowances = inRange('contractualAllowances')
  let netPatientRevenue = inRange('netPatientRevenue')
  let totalOperatingExpenses = inRange('totalOperatingExpenses')
  let netIncomeFromService = inRange('netIncomeFromService')
  const otherIncome = inRange('otherIncome')
  const totalIncome = inRange('totalIncome')
  const netIncome = inRange('netIncome')
  const cash = inRange('cash')
  const accountsReceivable = inRange('accountsReceivable')
  const totalCurrentAssets = inRange('totalCurrentAssets')
  let totalAssets = inRange('totalAssets')
  const accountsPayable = inRange('accountsPayable')
  const totalCurrentLiabilities = inRange('totalCurrentLiabilities')
  const totalLongTermLiabilities = inRange('totalLongTermLiabilities')
  let totalLiabilities = inRange('totalLiabilities')
  let fundBalance = inRange('fundBalance')

  // Itemized other-expenses lines (G-3 lines 27-30) with the filer's own ALPHA labels.
  const otherExpenseLines = (['02700', '02800', '02900', '03000'] as const)
    .map((lineNum, i) => ({
      value: inRange(`otherExpense${27 + i}`),
      label: alphaLabels?.get(lineNum)
    }))
    .filter((l) => l.value != null && l.value !== 0)
  const otherExpenses = otherExpenseLines.length > 0 ? otherExpenseLines.reduce((sum, l) => sum + l.value!, 0) : null
  const otherExpensesLabels = otherExpenseLines.map((l) => (l.label ? titleCaseLabel(l.label) : 'Other expenses'))

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

  // Net patient revenue = total patient revenue minus contractual allowances, exactly, on the
  // filed form. A 1% tolerance absorbs rounding on odd report periods; a bigger gap means one of
  // the three cells is not what its coordinate claims, so the deduction line is the one dropped.
  if (totalPatientRevenue != null && netPatientRevenue != null && contractualAllowances != null) {
    const expected = totalPatientRevenue - contractualAllowances
    if (Math.abs(expected - netPatientRevenue) > Math.max(1000, totalPatientRevenue * 0.01)) {
      warnings.push(
        `${ctx}: contractualAllowances (${contractualAllowances}) inconsistent with total (${totalPatientRevenue}) and net (${netPatientRevenue}) patient revenue -- allowances dropped`
      )
      contractualAllowances = null
    }
  }

  // Net income from service = net patient revenue minus total operating expenses, exactly.
  if (netPatientRevenue != null && totalOperatingExpenses != null && netIncomeFromService != null) {
    const expected = netPatientRevenue - totalOperatingExpenses
    if (Math.abs(expected - netIncomeFromService) > Math.max(1000, netPatientRevenue * 0.01)) {
      warnings.push(
        `${ctx}: netIncomeFromService (${netIncomeFromService}) inconsistent with net revenue (${netPatientRevenue}) minus expenses (${totalOperatingExpenses}) -- netIncomeFromService dropped`
      )
      netIncomeFromService = null
    }
  }

  // Total income = net income from service + other income; net income = total income - other
  // expenses. Checked when all sides are present; a mismatch flags in the log but keeps the
  // filed lines (the itemized block can omit lines a filer left blank on the form).
  if (netIncome != null && totalIncome != null && otherExpenses != null) {
    const expected = totalIncome - otherExpenses
    if (Math.abs(expected - netIncome) > Math.max(1000, Math.abs(totalIncome) * 0.01)) {
      warnings.push(`${ctx}: netIncome (${netIncome}) != totalIncome (${totalIncome}) - otherExpenses (${otherExpenses})`)
    }
  }

  // Total assets = total liabilities + fund balance, exactly, on the balance sheet. A real break
  // of that identity means one of the three cells is misread, so the trio is dropped together.
  if (totalAssets != null && totalLiabilities != null && fundBalance != null) {
    const expected = totalLiabilities + fundBalance
    if (Math.abs(expected - totalAssets) > Math.max(1000, totalAssets * 0.01)) {
      warnings.push(
        `${ctx}: totalAssets (${totalAssets}) != totalLiabilities (${totalLiabilities}) + fundBalance (${fundBalance}) -- balance-sheet totals dropped`
      )
      totalAssets = null
      totalLiabilities = null
      fundBalance = null
    }
  }

  const occupancyPct = bedDaysAvailable && bedDaysAvailable > 0 ? round1((totalPatientDays / bedDaysAvailable) * 100) : null
  if (occupancyPct != null && (occupancyPct < 0 || occupancyPct > 110)) {
    warnings.push(`${ctx}: computed occupancy ${occupancyPct}% outside plausible 0-110% -- occupancy dropped`)
  }

  const otherPatientDays =
    medicarePatientDays != null && medicaidPatientDays != null ? totalPatientDays - medicarePatientDays - medicaidPatientDays : null

  const payerPct = (days: number | null): number | null =>
    days != null && totalPatientDays > 0 ? round1((days / totalPatientDays) * 100) : null

  // Patient-services margin: net income from service to patients as a share of net patient
  // revenue (Worksheet G-3 line 5 over line 3). This is the margin on patient care itself,
  // before other income and taxes.
  const operatingMarginPct =
    netIncomeFromService != null && netPatientRevenue && netPatientRevenue > 0
      ? round1((netIncomeFromService / netPatientRevenue) * 100)
      : null

  const record: FacilityYearRecord = {
    ccn: rpt.prvdrNum,
    fyBeginDate: rpt.fyBeginDate,
    fyEndDate: rpt.fyEndDate,
    reportStatus: rpt.rptStatusCode,
    reportStatusLabel: REPORT_STATUS_LABELS[rpt.rptStatusCode] ?? 'Unknown',
    processDate: rpt.processDate,
    bedsAvailable,
    bedDaysAvailable,
    totalPatientDays,
    medicarePatientDays,
    medicaidPatientDays,
    otherPatientDays,
    occupancyPct: occupancyPct != null && occupancyPct >= 0 && occupancyPct <= 110 ? occupancyPct : null,
    medicarePct: payerPct(medicarePatientDays),
    medicaidPct: payerPct(medicaidPatientDays),
    otherPct: payerPct(otherPatientDays),
    totalPatientRevenue,
    contractualAllowances,
    netPatientRevenue,
    totalOperatingExpenses,
    netIncomeFromService,
    otherIncome,
    totalIncome,
    otherExpenses,
    otherExpensesLabels,
    netIncome,
    operatingMarginPct,
    cash,
    accountsReceivable,
    totalCurrentAssets,
    totalAssets,
    accountsPayable,
    totalCurrentLiabilities,
    totalLongTermLiabilities,
    totalLiabilities,
    fundBalance
  }

  return { record, warnings }
}
