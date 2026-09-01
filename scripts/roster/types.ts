// Mirrors src/types/facility.ts's SnfRecord/HospitalRecord exactly -- this is the wire format the
// browser deserializes public/data/{snf,hospital}-roster.json into. Kept as a separate copy here
// rather than importing from src/types (scripts/roster/ stays self-contained, matching the
// existing scripts/hcris/ convention -- see scripts/roster/fetchDataset.ts for why).

export type HospitalType = 'Acute Care' | 'Critical Access' | 'Psychiatric' | "Children's" | 'VA' | 'DoD' | 'LTCH' | 'Inpatient Rehab' | 'Other'

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
  specialFocusFacility: boolean
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
