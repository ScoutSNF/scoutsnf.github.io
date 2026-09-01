import type { HospitalRecord } from './types.js'
import { findColumn, parseNum } from './csv.js'
import { fetchCmsDatasetTable, type OnRetry } from './fetchDataset.js'
import { CMS_HOSPITAL_DATASET_ID } from './sources.js'
import { classifyHospitalType } from './hospitalType.js'

const SOURCE_LABEL = 'Hospital roster'

/**
 * Port of src/data/hospital.ts, unchanged logic. Hospital General Information has no lat/lon or
 * bed counts -- those get filled in separately (geocode.ts / fetchBedCounts.ts), which is exactly
 * the live, per-visitor client-side work this whole pipeline exists to move into CI.
 */
export async function fetchHospitalRecords(onRetry?: OnRetry): Promise<HospitalRecord[]> {
  const table = await fetchCmsDatasetTable(CMS_HOSPITAL_DATASET_ID, SOURCE_LABEL, onRetry)

  const col = {
    ccn: findColumn(table, ['facility_id', 'ccn', 'provider_number']),
    name: findColumn(table, ['facility_name', 'hospital_name']),
    address: findColumn(table, ['address']),
    city: findColumn(table, ['city_town', 'city']),
    state: findColumn(table, ['state']),
    zip: findColumn(table, ['zip_code', 'zip']),
    hospitalType: findColumn(table, ['hospital_type']),
    rating: findColumn(table, ['hospital_overall_rating', 'overall_rating']),
    emergency: findColumn(table, ['emergency_services'])
  }

  const records: HospitalRecord[] = []
  for (const row of table.rows) {
    const ccn = col.ccn !== -1 ? row[col.ccn]?.trim() : ''
    if (!ccn) continue

    const emergencyRaw = col.emergency !== -1 ? row[col.emergency]?.trim().toLowerCase() : ''
    const hospitalTypeRaw = col.hospitalType !== -1 ? row[col.hospitalType] ?? '' : ''

    records.push({
      kind: 'hospital',
      ccn,
      name: col.name !== -1 ? row[col.name] ?? '' : '',
      address: col.address !== -1 ? row[col.address] ?? '' : '',
      city: col.city !== -1 ? row[col.city] ?? '' : '',
      state: col.state !== -1 ? row[col.state] ?? '' : '',
      zip: col.zip !== -1 ? row[col.zip] ?? '' : '',
      latitude: null,
      longitude: null,
      hospitalType: classifyHospitalType(hospitalTypeRaw),
      hospitalTypeRaw,
      overallRating: col.rating !== -1 ? parseNum(row[col.rating]) : null,
      emergencyServices: emergencyRaw === '' ? null : emergencyRaw === 'yes' || emergencyRaw === 'y',
      certifiedBeds: null,
      occupancyPct: null
    })
  }
  return records
}
