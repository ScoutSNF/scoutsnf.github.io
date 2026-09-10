export type FacilityKind = 'snf' | 'hospital'

/**
 * CMS's Special Focus program has two distinct populations. 'sff' is a facility currently *in*
 * the program (under 100 nationally, surveyed about twice a year, carrying real termination
 * exposure); 'candidate' is one on the watch list eligible for selection (several hundred). Only
 * an 'sff' gets the red hand on CMS Care Compare. Treating them as one boolean overstated the
 * risk on roughly 440 facilities, so they stay separate everywhere -- badge, filter, and export.
 */
export type SpecialFocusStatus = 'sff' | 'candidate'

export type HospitalType =
  | 'Acute Care'
  | 'Critical Access'
  | 'Psychiatric'
  | "Children's"
  | 'VA'
  | 'DoD'
  | 'LTCH'
  | 'Inpatient Rehab'
  | 'Other'

/** Raw CMS "Provider Information" row for a skilled nursing facility, parsed to native types. */
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
  /** avgDailyCensus / certifiedBeds, 0-100+. Null if not computable. */
  occupancyPct: number | null
  overallRating: number | null
  healthInspectionRating: number | null
  staffingRating: number | null
  qualityMeasureRating: number | null
  ownershipType: string | null
  specialFocusStatus: SpecialFocusStatus | null
  /** CMS's verbatim `special_focus_status` cell. */
  specialFocusStatusRaw: string | null
  /**
   * Legacy shape, still present on records cached in IndexedDB from before the SFF/candidate
   * split. Read it through `getSpecialFocus()` rather than directly -- it disappears on its own
   * once a browser picks up a roster published by the current pipeline.
   * @deprecated
   */
  specialFocusFacility?: boolean
  /** CMS "data as of" date for this SNF's metrics. */
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
  /** Null until a cost-report-based figure is wired in. */
  occupancyPct: number | null
}

export type FacilityRecord = SnfRecord | HospitalRecord

export interface GeoPoint {
  latitude: number
  longitude: number
}

export interface FacilityWithDistance<T extends FacilityRecord = FacilityRecord> {
  facility: T
  distanceMiles: number
}

export interface SavedFacility {
  ccn: string
  kind: FacilityKind
  name: string
  city: string
  state: string
  radiusMiles: number
  notes: string
  savedAt: string
  order: number
}

export interface DatasetMeta {
  key: string
  fetchedAt: string
}

export interface Portfolio {
  id: string
  name: string
  createdAt: string
  order: number
}

export interface PortfolioMember {
  id: string // `${portfolioId}:${facilityId}`
  portfolioId: string
  facilityId: string // `${kind}:${ccn}`
}
