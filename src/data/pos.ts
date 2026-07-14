import { CMS_DATA_JSON_URL, CMS_DATA_API_DATASET_URL } from './sources'
import { fetchWithRetry, SourceFetchError } from '../lib/fetchRetry'
import { findColumn, parseNum } from '../lib/csv'
import { fetchCmsDatasetTable } from './dkan'

const POS_TITLE_PATTERN = /provider of services file.*hospital/i

interface DcatDataset {
  title?: string
  identifier?: string
}

/**
 * Preferred lookup: the same Provider Data Catalog metastore API that
 * fetchHospitalRecords/fetchSnfRecords already use successfully (proven
 * reachable through the CORS proxy). Not guaranteed to include the POS
 * file, so failures here fall through to the data.json catalog below
 * rather than failing the whole bed-count fetch.
 */
async function findPosDatasetIdViaMetastore(): Promise<string | null> {
  const res = await fetchWithRetry(
    'https://data.cms.gov/provider-data/api/1/metastore/schemas/dataset/items?show-reference-ids=false',
    'Provider data catalog'
  )
  const json = (await res.json()) as DcatDataset[] | { data?: DcatDataset[] }
  const items = Array.isArray(json) ? json : json.data ?? []
  const match = items.find((d) => POS_TITLE_PATTERN.test(d.title ?? ''))
  return match?.identifier ?? null
}

async function fetchBedsViaMetastore(): Promise<Map<string, number> | null> {
  const id = await findPosDatasetIdViaMetastore()
  if (!id) return null
  const table = await fetchCmsDatasetTable(id, 'Hospital bed data')
  const ccnIdx = findColumn(table, ['prvdr_num', 'ccn', 'federal_provider_number'])
  const bedIdx = findColumn(table, ['crtfd_bed_cnt', 'certified_bed_cnt', 'bed_cnt'])
  if (ccnIdx === -1 || bedIdx === -1) return null

  const beds = new Map<string, number>()
  for (const row of table.rows) {
    const ccn = row[ccnIdx]?.trim()
    const bedCount = parseNum(row[bedIdx])
    if (ccn && bedCount != null) beds.set(ccn, bedCount)
  }
  return beds.size > 0 ? beds : null
}

async function findPosDatasetUuid(): Promise<string> {
  const res = await fetchWithRetry(CMS_DATA_JSON_URL, 'POS catalog')
  const json = (await res.json()) as { dataset?: DcatDataset[] }
  const match = (json.dataset ?? []).find((d) => POS_TITLE_PATTERN.test(d.title ?? ''))
  if (!match?.identifier) {
    throw new SourceFetchError('Hospital bed data', 'Hospital bed data unavailable — retry')
  }
  return match.identifier
}

async function fetchBedsViaDataJson(): Promise<Map<string, number>> {
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

    // Advance by the page actually received, not the requested size — the API
    // can silently cap its response below the requested size, and incrementing
    // by the requested amount would skip straight past the untransferred rows.
    offset += page.length
    if (offset > 100_000) break // safety cap
  }
  return beds
}

/** Fetches certified bed counts from the CMS Provider of Services file, keyed by CCN. */
export async function fetchHospitalBedCounts(): Promise<Map<string, number>> {
  try {
    const beds = await fetchBedsViaMetastore()
    if (beds) return beds
    console.warn('[pos] metastore lookup found no usable POS dataset, falling back to data.json catalog')
  } catch (err) {
    console.warn('[pos] metastore bed lookup failed, falling back to data.json catalog', err)
  }
  return fetchBedsViaDataJson()
}
