import { CMS_DATA_JSON_URL, CMS_DATA_API_DATASET_URL } from './sources'
import { fetchWithRetry, SourceFetchError } from '../lib/fetchRetry'
import { findColumn, parseNum } from '../lib/csv'

interface DcatDataset {
  title?: string
  identifier?: string
}

async function findPosDatasetUuid(): Promise<string> {
  const res = await fetchWithRetry(CMS_DATA_JSON_URL, 'POS catalog')
  const json = (await res.json()) as { dataset?: DcatDataset[] }
  const match = (json.dataset ?? []).find((d) =>
    /provider of services file.*hospital/i.test(d.title ?? '')
  )
  if (!match?.identifier) {
    throw new SourceFetchError('Hospital bed data', 'Hospital bed data unavailable — retry')
  }
  return match.identifier
}

/** Fetches certified bed counts from the CMS Provider of Services file, keyed by CCN. */
export async function fetchHospitalBedCounts(): Promise<Map<string, number>> {
  const uuid = await findPosDatasetUuid()
  const pageSize = 5000
  let offset = 0
  const beds = new Map<string, number>()
  let headers: string[] | null = null
  let ccnIdx = -1
  let bedIdx = -1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetchWithRetry(
      `${CMS_DATA_API_DATASET_URL(uuid)}?size=${pageSize}&offset=${offset}`,
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

    if (page.length < pageSize) break
    offset += pageSize
    if (offset > 100_000) break // safety cap
  }
  return beds
}
