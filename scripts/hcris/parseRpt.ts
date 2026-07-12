import { parseCsv } from './csvUtil.js'
import type { RptRow } from './types.js'

/**
 * RPT.CSV column order (headerless). Sourced from working HCRIS-processing reference code
 * (asacarny/hospital-cost-reports, NBER's HCRIS read scripts) rather than an official CMS
 * dictionary this sandbox could fetch directly -- higher confidence than the worksheet/line/column
 * guesses in metricCatalog.ts, but still worth spot-checking against the first real pipeline run.
 */
const COL = {
  rptRecNum: 0,
  prvdrCtrlTypeCd: 1,
  prvdrNum: 2,
  npi: 3,
  rptStusCd: 4,
  fyBgnDt: 5,
  fyEndDt: 6,
  procDt: 7
  // remaining columns (initl_rpt_sw, last_rpt_sw, trnsmtl_num, fi_num, adr_vndr_cd, fi_creat_dt,
  // util_cd, npr_dt, spec_ind, fi_rcpt_dt) aren't needed yet.
} as const

/** HCRIS dates are typically MM/DD/YYYY; normalize to ISO yyyy-mm-dd. Returns null if unparseable. */
export function normalizeHcrisDate(raw: string | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const [, mm, dd, yyyy] = m
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}/)
  if (isoMatch) return isoMatch[0]
  return null
}

export interface ParseRptResult {
  rows: Map<string, RptRow> // keyed by rptRecNum
  skipped: number
}

/** Parses a full RPT.CSV file's text (small enough to hold in memory -- one row per cost report). */
export function parseRpt(text: string): ParseRptResult {
  const rows = new Map<string, RptRow>()
  let skipped = 0

  for (const fields of parseCsv(text)) {
    const rptRecNum = fields[COL.rptRecNum]?.trim()
    const prvdrNum = fields[COL.prvdrNum]?.trim()
    const rptStusRaw = fields[COL.rptStusCd]?.trim()
    const fyBeginDate = normalizeHcrisDate(fields[COL.fyBgnDt])
    const fyEndDate = normalizeHcrisDate(fields[COL.fyEndDt])
    const processDate = normalizeHcrisDate(fields[COL.procDt])
    const rptStatusCode = rptStusRaw ? Number(rptStusRaw) : NaN

    if (
      !rptRecNum ||
      !prvdrNum ||
      !fyBeginDate ||
      !fyEndDate ||
      !Number.isInteger(rptStatusCode) ||
      rptStatusCode < 1 ||
      rptStatusCode > 5 ||
      fyEndDate <= fyBeginDate
    ) {
      skipped++
      continue
    }

    rows.set(rptRecNum, {
      rptRecNum,
      prvdrNum,
      fyBeginDate,
      fyEndDate,
      rptStatusCode,
      processDate
    })
  }

  return { rows, skipped }
}
