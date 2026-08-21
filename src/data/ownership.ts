import { CMS_DATASTORE_QUERY_URL, CMS_OWNERSHIP_DATASET_ID } from './sources'
import { fetchWithRetry } from '../lib/fetchRetry'
import { db, type OwnershipRecord } from './db'

export type { OwnershipRecord }

function singleFacilityQueryUrl(ccn: string): string {
  const params = new URLSearchParams({
    limit: '50',
    offset: '0',
    'conditions[0][property]': 'cms_certification_number_ccn',
    'conditions[0][value]': ccn,
    'conditions[0][operator]': '='
  })
  return `${CMS_DATASTORE_QUERY_URL(CMS_OWNERSHIP_DATASET_ID)}?${params.toString()}`
}

/**
 * Owners/managers for one SNF (name, role, ownership %), cached in IndexedDB by CCN so each
 * facility is only ever looked up once per browser. Fetched per-facility on demand (only once a
 * result row is expanded) rather than bulk-pulled for the whole roster -- nationally this table
 * runs many rows per facility, so pulling it for all ~5,400 SNFs on every refresh would be a much
 * larger, mostly-unused download. Hospitals aren't covered by this CMS dataset.
 */
export async function fetchOwnership(ccn: string): Promise<OwnershipRecord[]> {
  const cached = await db.ownership.get(ccn)
  if (cached) return cached.records

  const res = await fetchWithRetry(singleFacilityQueryUrl(ccn), 'Ownership data', undefined, { attempts: 2 })
  const json = (await res.json()) as { results?: Record<string, string>[] }
  const records: OwnershipRecord[] = (json.results ?? []).map((r) => ({
    ownerName: r.owner_name ?? '',
    ownerType: r.owner_type ?? '',
    role: r.role_played_by_owner_or_manager_in_facility ?? '',
    percentage: r.ownership_percentage ?? '',
    associationDate: r.association_date ?? ''
  }))

  // Only a successful fetch gets cached -- a legitimately-empty result (no ownership disclosure
  // on file) is worth remembering, but a transient network failure shouldn't be, since that
  // would permanently hide data that's really just one retry away.
  await db.ownership.put({ ccn, records, fetchedAt: new Date().toISOString() })
  return records
}
