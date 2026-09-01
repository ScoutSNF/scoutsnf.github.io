export const CMS_DATASTORE_QUERY_URL = (id: string) =>
  `https://data.cms.gov/provider-data/api/1/datastore/query/${id}/0`

/**
 * "Ownership" — SNF owner/manager disclosure (name, role, ownership %), confirmed directly
 * against the live CMS Provider Data Catalog metastore (title search for "ownership" returns
 * exactly this one dataset) and cross-checked row-for-row against Highland Care Center's real
 * medicare.gov ownership page. Unlike the POS dataset, this one *is* discoverable by title, but
 * it's hardcoded anyway since it's looked up once here rather than per-request.
 *
 * The SNF/hospital roster, hospital geocoding, and hospital bed counts are no longer fetched live
 * from the browser at all -- that now happens in the scripts/roster/ CI pipeline
 * (.github/workflows/roster-pipeline.yml), which publishes public/data/{snf,hospital}-roster.json
 * as static same-origin files. This dataset stays here because owner-name search
 * (src/hooks/useOwnerNameSearch.ts) is genuinely on-demand and per-query, not part of app
 * startup, so there's no equivalent reason to move it out of the browser.
 */
export const CMS_OWNERSHIP_DATASET_ID = 'y2hd-n93e'
