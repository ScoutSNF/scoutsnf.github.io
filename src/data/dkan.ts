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

/** Paginated fallback via the datastore query JSON API, used if the CSV bulk pull fails. */
async function fetchAllRowsViaQueryApi(datasetId: string, label: string, onRetry?: OnRetry): Promise<CsvTable> {
  const pageSize = 5000
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
    allRows.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
    if (offset > 200_000) break // safety cap
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
  try {
    const csvUrl = await resolveCsvDownloadUrl(datasetId, label, onRetry)
    if (csvUrl) {
      const res = await fetchWithRetry(csvUrl, `${label} CSV`, undefined, { onRetry })
      const text = await res.text()
      const table = parseCsvTable(text)
      if (table.rows.length > 0) return table
    }
  } catch {
    // fall through to JSON pagination
  }
  return fetchAllRowsViaQueryApi(datasetId, label, onRetry)
}
