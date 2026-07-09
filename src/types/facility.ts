export type FacilityKind = 'snf' | 'hospital'

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
  specialFocusFacility: boolean
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
  /** From HHS facility-level capacity file. Null if never available for this CCN. */
  occupancyPct: number | null
  /** ISO date (Monday) of the HHS collection_week the occupancy value came from. */
  occupancyAsOfWeek: string | null
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
