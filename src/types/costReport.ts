export interface FacilityYearRecord {
  ccn: string
  fyBeginDate: string
  fyEndDate: string
  reportStatus: number
  reportStatusLabel: string
  processDate: string | null
  bedsAvailable: number | null
  totalPatientDays: number | null
  medicarePatientDays: number | null
  medicaidPatientDays: number | null
  otherPatientDays: number | null
  occupancyPct: number | null
  medicarePct: number | null
  medicaidPct: number | null
  otherPct: number | null
  totalPatientRevenue: number | null
  netPatientRevenue: number | null
  totalOperatingExpenses: number | null
  netIncome: number | null
  operatingMarginPct: number | null
}

export interface HcrisOutput {
  generatedAt: string
  fiscalYearsIncluded: number[]
  records: Record<string, FacilityYearRecord[]>
}
