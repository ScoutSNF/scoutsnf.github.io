import type { SnfRecord, SpecialFocusStatus } from './types.js'
import { findColumn, parseNum } from './csv.js'
import { fetchCmsDatasetTable, type OnRetry } from './fetchDataset.js'
import { CMS_SNF_DATASET_ID } from './sources.js'

const SOURCE_LABEL = 'SNF roster'

/**
 * CMS's `special_focus_status` is a label, not a yes/no -- "SFF" and "SFF Candidate" are
 * different populations. An earlier `/sff|yes|true/` substring test matched both, flagging 525
 * of 14,690 facilities as Special Focus when the real program is under 100; the rest were
 * candidates, which is why they showed no red hand on Care Compare.
 *
 * "candidate" is checked first precisely because "SFF Candidate" contains "SFF". The test is on
 * the substring rather than an exact string so a wording or casing change on CMS's side
 * degrades to the safer classification instead of silently promoting candidates again.
 */
export function classifySpecialFocus(raw: string | null | undefined): SpecialFocusStatus | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  if (/candidate/i.test(value)) return 'candidate'
  if (/sff|special focus|yes|true/i.test(value)) return 'sff'
  return null
}

/** Port of src/data/snf.ts, unchanged logic -- see scripts/roster/fetchDataset.ts for why this is a separate copy. */
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
    // Adjusted, not reported: CMS risk-adjusts this one for resident acuity, so it is the only
    // nurse-staffing figure comparable between facilities. Several spellings are listed because
    // CMS has renamed these columns across releases; findColumn returns -1 if none match, which
    // leaves the field null rather than failing the build -- a thin roster, not a broken one.
    hprd: findColumn(table, [
      'adjusted_total_nurse_staffing_hours_per_resident_per_day',
      'adjusted_total_nurse_staffing_hours_per_resident_day',
      'total_nurse_staffing_hours_per_resident_per_day',
      'adjusted_total_nurse_staffing'
    ]),
    county: findColumn(table, ['county_parish', 'provider_county_name', 'county_name', 'county']),
    ownership: findColumn(table, ['ownership_type']),
    phone: findColumn(table, ['telephone_number', 'phone_number', 'provider_phone_number']),
    legalName: findColumn(table, ['legal_business_name']),
    chain: findColumn(table, ['chain_name']),
    lsQm: findColumn(table, ['long_stay_qm_rating']),
    ssQm: findColumn(table, ['short_stay_qm_rating']),
    // Same adjusted-vs-reported distinction as `hprd` above: the adjusted figures are the ones CMS
    // risk-adjusts for resident acuity, so they are the ones comparable between facilities. PT has
    // no adjusted figure in the dataset, so the reported one is mapped and labelled as reported.
    rnHprd: findColumn(table, ['adjusted_rn_staffing_hours_per_resident_per_day']),
    lpnHprd: findColumn(table, ['adjusted_lpn_staffing_hours_per_resident_per_day']),
    aideHprd: findColumn(table, ['adjusted_nurse_aide_staffing_hours_per_resident_per_day']),
    weekendHprd: findColumn(table, ['adjusted_weekend_total_nurse_staffing_hours_per_resident_per_day']),
    ptHprd: findColumn(table, ['reported_physical_therapist_staffing_hours_per_resident_per_day']),
    nursingTurnover: findColumn(table, ['total_nursing_staff_turnover']),
    rnTurnover: findColumn(table, ['registered_nurse_turnover']),
    cmi: findColumn(table, ['nursing_case_mix_index']),
    cmiRatio: findColumn(table, ['nursing_case_mix_index_ratio']),
    survey1Date: findColumn(table, ['rating_cycle_1_standard_survey_health_date']),
    survey1Defs: findColumn(table, ['rating_cycle_1_total_number_of_health_deficiencies']),
    survey2Date: findColumn(table, ['rating_cycle_2_standard_health_survey_date']),
    survey2Defs: findColumn(table, ['rating_cycle_2_3_total_number_of_health_deficiencies']),
    weightedScore: findColumn(table, ['total_weighted_health_survey_score']),
    fines: findColumn(table, ['total_amount_of_fines_in_dollars']),
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
      totalNurseStaffingHprd: col.hprd !== -1 ? parseNum(row[col.hprd]) : null,
      county: col.county !== -1 ? row[col.county]?.trim() || null : null,
      ownershipType: col.ownership !== -1 ? row[col.ownership] || null : null,
      specialFocusStatus: col.sff !== -1 ? classifySpecialFocus(row[col.sff]) : null,
      specialFocusStatusRaw: col.sff !== -1 ? row[col.sff]?.trim() || null : null,
      phoneNumber: col.phone !== -1 ? row[col.phone]?.trim() || null : null,
      legalBusinessName: col.legalName !== -1 ? row[col.legalName]?.trim() || null : null,
      chainName: col.chain !== -1 ? row[col.chain]?.trim() || null : null,
      longStayQmRating: col.lsQm !== -1 ? parseNum(row[col.lsQm]) : null,
      shortStayQmRating: col.ssQm !== -1 ? parseNum(row[col.ssQm]) : null,
      rnStaffingHprd: col.rnHprd !== -1 ? parseNum(row[col.rnHprd]) : null,
      lpnStaffingHprd: col.lpnHprd !== -1 ? parseNum(row[col.lpnHprd]) : null,
      aideStaffingHprd: col.aideHprd !== -1 ? parseNum(row[col.aideHprd]) : null,
      weekendNurseStaffingHprd: col.weekendHprd !== -1 ? parseNum(row[col.weekendHprd]) : null,
      ptStaffingHprd: col.ptHprd !== -1 ? parseNum(row[col.ptHprd]) : null,
      nursingTurnoverPct: col.nursingTurnover !== -1 ? parseNum(row[col.nursingTurnover]) : null,
      rnTurnoverPct: col.rnTurnover !== -1 ? parseNum(row[col.rnTurnover]) : null,
      caseMixIndex: col.cmi !== -1 ? parseNum(row[col.cmi]) : null,
      caseMixRatio: col.cmiRatio !== -1 ? parseNum(row[col.cmiRatio]) : null,
      latestSurveyDate: col.survey1Date !== -1 ? row[col.survey1Date]?.trim() || null : null,
      latestSurveyDeficiencies: col.survey1Defs !== -1 ? parseNum(row[col.survey1Defs]) : null,
      priorSurveyDate: col.survey2Date !== -1 ? row[col.survey2Date]?.trim() || null : null,
      priorSurveyDeficiencies: col.survey2Defs !== -1 ? parseNum(row[col.survey2Defs]) : null,
      weightedSurveyScore: col.weightedScore !== -1 ? parseNum(row[col.weightedScore]) : null,
      totalFinesAmount: col.fines !== -1 ? parseNum(row[col.fines]) : null,
      processingDate: col.processingDate !== -1 ? row[col.processingDate] || null : null
    })
  }
  return records
      }
