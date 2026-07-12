import type { FacilityYearRecord } from './types.js'

/**
 * Merges records keyed on (ccn, fyBeginDate). When two records collide (e.g. this quarter's FY2025
 * file vs. last quarter's), keeps the one with the higher report status code, tiebreaking on the
 * newer process date -- never keeps two rows for the same facility-year.
 */
export function upsertRecords(existing: FacilityYearRecord[], incoming: FacilityYearRecord[]): FacilityYearRecord[] {
  const byKey = new Map<string, FacilityYearRecord>()
  const keyOf = (r: FacilityYearRecord) => `${r.ccn}|${r.fyBeginDate}`

  for (const r of existing) byKey.set(keyOf(r), r)

  for (const r of incoming) {
    const key = keyOf(r)
    const prior = byKey.get(key)
    if (!prior) {
      byKey.set(key, r)
      continue
    }
    const better =
      r.reportStatus > prior.reportStatus ||
      (r.reportStatus === prior.reportStatus && (r.processDate ?? '') > (prior.processDate ?? ''))
    if (better) byKey.set(key, r)
  }

  return [...byKey.values()].sort((a, b) => (a.ccn === b.ccn ? a.fyBeginDate.localeCompare(b.fyBeginDate) : a.ccn.localeCompare(b.ccn)))
}

/** Groups a flat record list by CCN, each facility's years sorted ascending -- the output shape the app consumes. */
export function groupByCcn(records: FacilityYearRecord[]): Record<string, FacilityYearRecord[]> {
  const byCcn: Record<string, FacilityYearRecord[]> = {}
  for (const r of records) {
    ;(byCcn[r.ccn] ??= []).push(r)
  }
  for (const list of Object.values(byCcn)) {
    list.sort((a, b) => a.fyBeginDate.localeCompare(b.fyBeginDate))
  }
  return byCcn
}
