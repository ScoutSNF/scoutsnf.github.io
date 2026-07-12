import type { SnfRecord } from '../types/facility'
import { findColumn, parseNum } from '../lib/csv'
import { fetchCmsDatasetTable, type OnRetry } from './dkan'
import { CMS_SNF_DATASET_ID } from './sources'

const SOURCE_LABEL = 'SNF roster'

export async function fetchSnfRecords(onRetry?: OnRetry): Promise<SnfRecord[]> {
  const table = await fetchCmsDatasetTable(CMS_SNF_DATASET_ID, SOURCE_LABEL, onRetry)

  const col = {
    ccn: findColumn(table, ['ccn', 'federal_provider_number', 'cms_certification_number_ccn', 'provider_number']),
    name: findColumn(table, ['provider_name', 'facility_name']),
    address: findColumn(table, ['provider_address', 'address']),
    city: findColumn(table, ['city_town', 'provider_city', 'city']),
    state: findColumn(table, ['state', 'provider_state']),
    zip: findColumn(table, ['zip_code', 'provider_zip_code', 'zip']),
    lat: findColumn(table, ['latitude']),
    lon: findColumn(table, ['longitude']),
    beds: findColumn(table, ['number_of_certified_beds']),
    adc: findColumn(table, ['average_number_of_residents_per_day']),
    overall: findColumn(table, ['overall_rating']),
    healthInspection: findColumn(table, ['health_inspection_rating']),
    staffing: findColumn(table, ['staffing_rating']),
    qm: findColumn(table, ['qm_rating', 'quality_measure_rating']),
    ownership: findColumn(table, ['ownership_type']),
    sff: findColumn(table, ['special_focus_status', 'special_focus_facility']),
    processingDate: findColumn(table, ['processing_date'])
  }

  const records: SnfRecord[] = []
  for (const row of table.rows) {
    const ccn = col.ccn !== -1 ? row[col.ccn]?.trim() : ''
    if (!ccn) continue

    const beds = col.beds !== -1 ? parseNum(row[col.beds]) : null
    const adc = col.adc !== -1 ? parseNum(row[col.adc]) : null
    const occupancyPct = beds && beds > 0 && adc ? Math.round((adc / beds) * 1000) / 10 : null

    records.push({
      kind: 'snf',
      ccn,
      name: col.name !== -1 ? row[col.name] ?? '' : '',
      address: col.address !== -1 ? row[col.address] ?? '' : '',
      city: col.city !== -1 ? row[col.city] ?? '' : '',
      state: col.state !== -1 ? row[col.state] ?? '' : '',
      zip: col.zip !== -1 ? row[col.zip] ?? '' : '',
      latitude: col.lat !== -1 ? parseNum(row[col.lat]) : null,
      longitude: col.lon !== -1 ? parseNum(row[col.lon]) : null,
      certifiedBeds: beds,
      avgDailyCensus: adc,
      occupancyPct,
      overallRating: col.overall !== -1 ? parseNum(row[col.overall]) : null,
      healthInspectionRating: col.healthInspection !== -1 ? parseNum(row[col.healthInspection]) : null,
      staffingRating: col.staffing !== -1 ? parseNum(row[col.staffing]) : null,
      qualityMeasureRating: col.qm !== -1 ? parseNum(row[col.qm]) : null,
      ownershipType: col.ownership !== -1 ? row[col.ownership] || null : null,
      specialFocusFacility: col.sff !== -1 ? /sff|yes|true/i.test(row[col.sff] ?? '') : false,
      processingDate: col.processingDate !== -1 ? row[col.processingDate] || null : null
    })
  }
  return records
}
