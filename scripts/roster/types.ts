// Mirrors src/types/facility.ts's SnfRecord/HospitalRecord exactly -- this is the wire format the
// browser deserializes public/data/{snf,hospital}-roster.json into. Kept as a separate copy here
// rather than importing from src/types (scripts/roster/ stays self-contained, matching the
// existing scripts/hcris/ convention -- see scripts/roster/fetchDataset.ts for why).

export type HospitalType = 'Acute Care' | 'Critical Access' | 'Psychiatric' | "Children's" | 'VA' | 'DoD' | 'LTCH' | 'Inpatient Rehab' | 'Other'

/**
 * CMS's Special Focus program has two distinct populations and they must not be collapsed:
 * 'sff' is a facility currently *in* the program (roughly 90 nationally, surveyed about twice a
 * year, carrying real termination exposure), while 'candidate' is one on the watch list eligible
 * for selection (several hundred). Only an 'sff' gets the red hand on CMS Care Compare.
 */
export type SpecialFocusStatus = 'sff' | 'candidate'

export interface SnfRecord {
  kind: 'snf'
  ccn: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  latitude: number | null
  longitude: number | null
  certifiedBeds: number | null
  avgDailyCensus: number | null
  occupancyPct: number | null
  overallRating: number | null
  healthInspectionRating: number | null
  staffingRating: number | null
  qualityMeasureRating: number | null
  /** CMS case-mix adjusted total nurse staffing hours per resident per day (RN + LPN + aide). */
  totalNurseStaffingHprd: number | null
  /** CMS "County/Parish", used to fall back to a county median where a radius is too thin. */
  county: string | null
  ownershipType: string | null
  specialFocusStatus: SpecialFocusStatus | null
  /** CMS's verbatim `special_focus_status` cell, kept so a future classification change can be
   *  made without re-fetching -- same reasoning as HospitalRecord.hospitalTypeRaw. */
  /** CMS "Telephone Number". Optional: rosters published before this field was mapped are still
   * cached in browsers, and a record read back from IndexedDB will not have it. Treat `undefined`
   * exactly like `null` -- unknown -- never as zero. */
  phoneNumber?: string | null
  /** CMS "Legal Business Name" -- the operating entity, often different from the facility name. */
  legalBusinessName?: string | null
  /** CMS "Chain Name". Null/empty means CMS lists the facility as not part of a chain. */
  chainName?: string | null
  /** CMS "Long-Stay QM Rating" (1-5). */
  longStayQmRating?: number | null
  /** CMS "Short-Stay QM Rating" (1-5). */
  shortStayQmRating?: number | null
  /** CMS case-mix adjusted RN staffing hours per resident per day. */
  rnStaffingHprd?: number | null
  /** CMS case-mix adjusted LPN staffing hours per resident per day. */
  lpnStaffingHprd?: number | null
  /** CMS case-mix adjusted nurse aide staffing hours per resident per day. */
  aideStaffingHprd?: number | null
  /** CMS case-mix adjusted total nurse staffing hours per resident per day on the weekend. */
  weekendNurseStaffingHprd?: number | null
  /** CMS *reported* (not adjusted) physical therapist staffing hours per resident per day. */
  ptStaffingHprd?: number | null
  /** CMS "Total nursing staff turnover" (percent). */
  nursingTurnoverPct?: number | null
  /** CMS "Registered Nurse turnover" (percent). */
  rnTurnoverPct?: number | null
  /** CMS "Nursing Case-Mix Index" -- resident acuity. */
  caseMixIndex?: number | null
  /** CMS "Nursing Case-Mix Index Ratio". */
  caseMixRatio?: number | null
  /** CMS "Rating Cycle 1 Standard Survey Health Date" (most recent standard survey), as published. */
  latestSurveyDate?: string | null
  /** Total health deficiencies cited in the most recent survey cycle. */
  latestSurveyDeficiencies?: number | null
  /** CMS "Rating Cycle 2 Standard Health Survey Date" (the cycle before the latest), as published. */
  priorSurveyDate?: string | null
  /** Total health deficiencies from the prior survey cycle. */
  priorSurveyDeficiencies?: number | null
  /** CMS "Total Weighted Health Survey Score" -- lower is better. */
  weightedSurveyScore?: number | null
  /** CMS "Total Amount of Fines in Dollars" over the current rating period. */
  totalFinesAmount?: number | null
  specialFocusStatusRaw: string | null
  processingDate: string | null
}

export interface HospitalRecord {
  kind: 'hospital'
  ccn: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  latitude: number | null
  longitude: number | null
  hospitalType: HospitalType
  hospitalTypeRaw: string
  overallRating: number | null
  emergencyServices: boolean | null
  certifiedBeds: number | null
  occupancyPct: number | null
  }
