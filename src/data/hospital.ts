import type { HospitalRecord } from '../types/facility'
import { findColumn, parseNum } from '../lib/csv'
import { fetchCmsDatasetTable } from './dkan'
import { CMS_HOSPITAL_DATASET_ID } from './sources'
import { classifyHospitalType } from '../lib/hospitalType'

const SOURCE_LABEL = 'Hospital roster'

/** Hospital General Information has no lat/lon or bed counts — those are joined in separately. */
export async function fetchHospitalRecords(): Promise<HospitalRecord[]> {
  const table = await fetchCmsDatasetTable(CMS_HOSPITAL_DATASET_ID, SOURCE_LABEL)

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
      occupancyPct: null,
      occupancyAsOfWeek: null
    })
  }
  return records
}
