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
  ownershipType: string | null
  specialFocusStatus: SpecialFocusStatus | null
  /** CMS's verbatim `special_focus_status` cell, kept so a future classification change can be
   *  made without re-fetching -- same reasoning as HospitalRecord.hospitalTypeRaw. */
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
