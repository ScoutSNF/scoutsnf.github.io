import { CMS_METASTORE_ITEM_URL, CMS_DATASTORE_QUERY_URL } from './sources'
import { fetchWithRetry } from '../lib/fetchRetry'
import { parseCsvTable, type CsvTable } from '../lib/csv'

export type OnRetry = (attempt: number, attempts: number) => void

interface DkanDistribution {
  data?: { downloadURL?: string; mediaType?: string; format?: string }
  downloadURL?: string
  mediaType?: string
  format?: string
}

interface DkanDatasetItem {
  distribution?: DkanDistribution[]
}

/** Resolves the CSV bulk-download URL for a CMS provider-data-catalog dataset via its metastore item. */
export async function resolveCsvDownloadUrl(datasetId: string, label: string, onRetry?: OnRetry): Promise<string | null> {
  const res = await fetchWithRetry(CMS_METASTORE_ITEM_URL(datasetId), `${label} metadata`, undefined, { onRetry })
  const json = (await res.json()) as DkanDatasetItem
  const distributions = json.distribution ?? []
  for (const dist of distributions) {
    const url = dist.downloadURL ?? dist.data?.downloadURL
    const mediaType = (dist.mediaType ?? dist.data?.mediaType ?? dist.format ?? dist.data?.format ?? '').toLowerCase()
    if (url && (mediaType.includes('csv') || url.toLowerCase().endsWith('.csv'))) {
      return url
    }
  }
  // No explicit CSV distribution found; take the first distribution as a best effort.
  return distributions[0]?.downloadURL ?? distributions[0]?.data?.downloadURL ?? null
}

// CMS's datastore query API rejects `limit` values above some undocumented cap with a
// flat 400 Bad Request (confirmed in production) rather than silently capping the page —
// so a too-large page size fails outright instead of just returning fewer rows. 500 is a
// conservative value well under any commonly-documented CKAN/DKAN datastore limit.
const QUERY_API_PAGE_SIZE = 500

/** Paginated fallback via the datastore query JSON API, used if the CSV bulk pull fails. */
async function fetchAllRowsViaQueryApi(datasetId: string, label: string, onRetry?: OnRetry): Promise<CsvTable> {
  const pageSize = QUERY_API_PAGE_SIZE
  let offset = 0
  const allRows: Record<string, unknown>[] = []
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetchWithRetry(
      `${CMS_DATASTORE_QUERY_URL(datasetId)}?limit=${pageSize}&offset=${offset}`,
      `${label} data`,
      undefined,
      { onRetry }
    )
    const json = (await res.json()) as { results?: Record<string, unknown>[] }
    const page = json.results ?? []
    if (page.length === 0) break
    allRows.push(...page)
    // Advance by the page actually received, not the requested limit — the API
    // can silently cap its response below the requested limit, and incrementing
    // by the requested amount would skip straight past the untransferred rows.
    offset += page.length
    if (allRows.length > 200_000) break // safety cap
  }
  const headers = allRows.length > 0 ? Object.keys(allRows[0]) : []
  const rows = allRows.map((r) => headers.map((h) => String(r[h] ?? '')))
  return {
    headers,
    normalizedHeaders: headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')),
    rows
  }
}

/** Fetches a full CMS dataset as a normalized table: CSV bulk pull first, JSON pagination as fallback. */
export async function fetchCmsDatasetTable(datasetId: string, label: string, onRetry?: OnRetry): Promise<CsvTable> {
  let csvTable: CsvTable | null = null
  try {
    const csvUrl = await resolveCsvDownloadUrl(datasetId, label, onRetry)
    if (csvUrl) {
      const res = await fetchWithRetry(csvUrl, `${label} CSV`, undefined, { onRetry })
      const text = await res.text()
      const table = parseCsvTable(text)
      if (table.rows.length > 0) csvTable = table
    }
  } catch {
    // fall through to the datastore query API below
  }

  if (!csvTable) return fetchAllRowsViaQueryApi(datasetId, label, onRetry)

  // The CSV distribution CMS attaches to a dataset's metadata isn't guaranteed to be
  // the full, current file — it can be stale or a smaller sample, and still "succeeds"
  // above since it's non-empty. Cheaply sanity-check its row count against a single
  // page of the live datastore query API before trusting it: if even one page already
  // has more rows than the whole CSV claims to, the CSV is truncated.
  try {
    const probeRes = await fetchWithRetry(
      `${CMS_DATASTORE_QUERY_URL(datasetId)}?limit=${QUERY_API_PAGE_SIZE}&offset=0`,
      `${label} data`,
      undefined,
      { onRetry }
    )
    const probeJson = (await probeRes.json()) as { results?: Record<string, unknown>[] }
    const probeCount = probeJson.results?.length ?? 0
    if (probeCount > csvTable.rows.length) return fetchAllRowsViaQueryApi(datasetId, label, onRetry)
  } catch {
    // Probe failed — trust the CSV we already have rather than losing it.
  }
  return csvTable
}
