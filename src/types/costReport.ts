export interface FacilityYearRecord {
  ccn: string
  fyBeginDate: string
  fyEndDate: string
  reportStatus: number
  reportStatusLabel: string
  processDate: string | null
  bedsAvailable: number | null
  bedDaysAvailable: number | null
  totalPatientDays: number | null
  medicarePatientDays: number | null
  medicaidPatientDays: number | null
  otherPatientDays: number | null
  occupancyPct: number | null
  medicarePct: number | null
  medicaidPct: number | null
  otherPct: number | null
  totalPatientRevenue: number | null
  contractualAllowances: number | null
  netPatientRevenue: number | null
  totalOperatingExpenses: number | null
  netIncomeFromService: number | null
  otherIncome: number | null
  totalIncome: number | null
  /** Sum of the filed itemized other-expenses lines (Worksheet G-3 lines 27-30). */
  otherExpenses: number | null
  /** ALPHA labels of the itemized other-expenses lines, as filed (may be truncated by CMS). */
  otherExpensesLabels: string[]
  /** Worksheet G-3 line 31, net income (loss) for the period, as filed. */
  netIncome: number | null
  /** Net income from service to patients as a share of net patient revenue. */
  operatingMarginPct: number | null
  cash: number | null
  accountsReceivable: number | null
  totalCurrentAssets: number | null
  totalAssets: number | null
  accountsPayable: number | null
  totalCurrentLiabilities: number | null
  totalLongTermLiabilities: number | null
  totalLiabilities: number | null
  fundBalance: number | null
}

export interface HcrisOutput {
  generatedAt: string
  fiscalYearsIncluded: number[]
  records: Record<string, FacilityYearRecord[]>
}
