export interface RptRow {
  rptRecNum: string
  prvdrNum: string
  fyBeginDate: string // ISO yyyy-mm-dd
  fyEndDate: string
  rptStatusCode: number // 1-5, see REPORT_STATUS_LABELS
  processDate: string | null
}

export const REPORT_STATUS_LABELS: Record<number, string> = {
  1: 'As submitted',
  2: 'Settled without audit',
  3: 'Settled with audit',
  4: 'Reopened',
  5: 'Amended'
}

/** One (WKSHT_CD, LINE_NUM, CLMN_NUM) cell we pull out of the NMRC firehose per report. */
export interface MetricDef {
  key: string
  wkshtCd: string
  lineNum: string
  clmnNum: string
  /** Sanity bounds applied to the extracted value before trusting it -- catches a bad cell reference. */
  plausibleRange?: [number, number]
}

/** Fast lookup key for a single NMRC cell coordinate. */
export function cellKey(wkshtCd: string, lineNum: string, clmnNum: string): string {
  return `${wkshtCd}|${lineNum}|${clmnNum}`
}

export interface RawMetricValues {
  [metricKey: string]: number
}

export interface FacilityYearRecord {
  ccn: string
  fyBeginDate: string
  fyEndDate: string
  reportStatus: number
  reportStatusLabel: string
  processDate: string | null
  bedsAvailable: number | null
  totalPatientDays: number | null
  medicarePatientDays: number | null
  medicaidPatientDays: number | null
  otherPatientDays: number | null
  occupancyPct: number | null
  medicarePct: number | null
  medicaidPct: number | null
  otherPct: number | null
  totalPatientRevenue: number | null
  netPatientRevenue: number | null
  totalOperatingExpenses: number | null
  netIncome: number | null
  operatingMarginPct: number | null
}

export interface HcrisOutput {
  generatedAt: string
  fiscalYearsIncluded: number[]
  records: Record<string, FacilityYearRecord[]>
}
