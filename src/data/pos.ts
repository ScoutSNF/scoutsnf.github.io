import { CMS_DATA_API_DATASET_URL, CMS_POS_HOSPITAL_DATASET_UUID } from './sources'
import { fetchWithRetry } from '../lib/fetchRetry'
import { findColumn, parseNum } from '../lib/csv'

/** Fetches certified bed counts from the CMS Provider of Services file, keyed by CCN. */
export async function fetchHospitalBedCounts(): Promise<Map<string, number>> {
  // CMS's datastore query API rejects overly-large `size` values with a flat 400 Bad
  // Request rather than silently capping them (confirmed in production for the sibling
  // provider-data query API in dkan.ts) — keep this conservative for the same reason.
  const pageSize = 500
  let offset = 0
  const beds = new Map<string, number>()
  let headers: string[] | null = null
  let ccnIdx = -1
  let bedIdx = -1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetchWithRetry(
      `${CMS_DATA_API_DATASET_URL(CMS_POS_HOSPITAL_DATASET_UUID)}?size=${pageSize}&offset=${offset}`,
      'Hospital bed data'
    )
    const json = (await res.json()) as Record<string, unknown>[] | { data?: Record<string, unknown>[] }
    const page = Array.isArray(json) ? json : json.data ?? []
    if (page.length === 0) break

    if (!headers) {
      headers = Object.keys(page[0])
      const table = { headers, normalizedHeaders: headers.map((h) => h.toLowerCase()), rows: [] }
      ccnIdx = findColumn(table, ['prvdr_num', 'ccn', 'federal_provider_number'])
      bedIdx = findColumn(table, ['crtfd_bed_cnt', 'certified_bed_cnt', 'bed_cnt'])
    }
    if (headers && ccnIdx !== -1 && bedIdx !== -1) {
      const ccnKey = headers[ccnIdx]
      const bedKey = headers[bedIdx]
      for (const row of page) {
        const ccn = String(row[ccnKey] ?? '').trim()
        const bedCount = parseNum(String(row[bedKey] ?? ''))
        if (ccn && bedCount != null) beds.set(ccn, bedCount)
      }
    }

    // Advance by the page actually received, not the requested size — the API
    // can silently cap its response below the requested size, and incrementing
    // by the requested amount would skip straight past the untransferred rows.
    offset += page.length
    if (offset > 100_000) break // safety cap
  }
  return beds
}
