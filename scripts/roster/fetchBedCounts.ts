import { CMS_DATA_API_DATASET_URL, CMS_POS_HOSPITAL_DATASET_UUID } from './sources.js'
import { fetchWithRetry } from './fetchRetry.js'
import { findColumn, parseNum, type CsvTable } from './csv.js'

/** Port of src/data/pos.ts. Fetches certified bed counts from the CMS Provider of Services file, keyed by CCN. */
export async function fetchHospitalBedCounts(): Promise<Map<string, number>> {
  const pageSize = 500
  let offset = 0
  const beds = new Map<string, number>()
  let headers: string[] | null = null
  let ccnIdx = -1
  let bedIdx = -1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetchWithRetry(`${CMS_DATA_API_DATASET_URL(CMS_POS_HOSPITAL_DATASET_UUID)}?size=${pageSize}&offset=${offset}`, 'Hospital bed data')
    const json = (await res.json()) as Record<string, unknown>[] | { data?: Record<string, unknown>[] }
    const page = Array.isArray(json) ? json : json.data ?? []
    if (page.length === 0) break

    if (!headers) {
      headers = Object.keys(page[0])
      const table: CsvTable = { headers, normalizedHeaders: headers.map((h) => h.toLowerCase()), rows: [] }
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

    offset += page.length
    if (offset > 100_000) break // safety cap
  }
  return beds
}
