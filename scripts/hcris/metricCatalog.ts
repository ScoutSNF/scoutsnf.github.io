import type { MetricDef } from './types.js'

/**
 * (WKSHT_CD, LINE_NUM, CLMN_NUM) coordinates for each metric we extract from the SNF-2010 form's
 * NMRC file.
 *
 * LINE_NUM/CLMN_NUM use HCRIS's native 5-digit encoding: line 1 -> "00100", column 2 -> "00200"
 * (third position is the decimal boundary; sub-line/sub-column go after it).
 *
 * Worksheet G-3 line semantics follow CMS Pub. 15-2 §4140.4 (the SNF-2010 form instructions):
 *   line 1  Total patient revenues
 *   line 2  Less: contractual allowances and discounts on patients' accounts
 *   line 3  Net patient revenues (line 1 minus line 2)
 *   line 4  Total operating expenses (from Worksheet A, column 3, line 200)
 *   line 5  Net income from service to patients (line 3 minus line 4)
 *   lines 21-24  Other income (itemized, line 24 is "other (specify)")
 *   line 25 Total other income (sum of lines 21-24)
 *   line 26 Total income (line 5 plus line 25)
 *   lines 27-30  Other expenses (itemized; line 27 has a "specify" ALPHA label)
 *   line 31 Net income (loss) for the period (line 26 minus lines 27-30)
 *
 * Every G-3/G coordinate below was re-verified against the filed FY2023 and FY2024 reports of a
 * known facility (CCN 335505): each extracted cell equals the value on that facility's filed
 * worksheet, and the accounting identities (1-2=3, 3-4=5, 5+25=26, 26-(27..30)=31,
 * assets=liabilities+fund balance) hold exactly on both years. An earlier version of this catalog
 * had the three G-3 revenue/expense coordinates shifted by two lines, which made the derived
 * "net income" equal the negative of contractual allowances.
 *
 * Every value extracted via these coordinates still passes through buildRecord.ts's plausibility
 * and cross-field checks before being trusted -- a wrong coordinate here should produce an
 * out-of-range or inconsistent value that gets caught and excluded, not a silently wrong number.
 */
export const METRIC_CATALOG: MetricDef[] = [
  {
    key: 'bedsAvailable',
    // CONFIRMED: SNF-2010 Worksheet S-3 Part I, line 1, column 1 = beds available.
    wkshtCd: 'S300001',
    lineNum: '00100',
    clmnNum: '00100',
    plausibleRange: [1, 2000]
  },
  {
    key: 'bedDaysAvailable',
    // CONFIRMED: same line, column 2 = total bed days available for the period.
    wkshtCd: 'S300001',
    lineNum: '00100',
    clmnNum: '00200',
    plausibleRange: [365, 730_000]
  },
  {
    key: 'totalPatientDays',
    // CONFIRMED: same line (S-3 Part I only has one line for a freestanding SNF), column 7.
    wkshtCd: 'S300001',
    lineNum: '00100',
    clmnNum: '00700',
    plausibleRange: [0, 730_000]
  },
  {
    key: 'medicarePatientDays',
    // CONFIRMED: same line, column 6. Verified against national aggregates across 400+ real
    // reports, not just per-record plausibility -- column 5 sums to 63.5% of total patient days
    // nationally (Medicaid's typical dominant SNF share), column 6 to 27.5% (Medicare's).
    wkshtCd: 'S300001',
    lineNum: '00100',
    clmnNum: '00600',
    plausibleRange: [0, 730_000]
  },
  {
    key: 'medicaidPatientDays',
    // CONFIRMED: same line, column 5. See medicarePatientDays -- these two were previously swapped;
    // a single-sample plausibility check missed it because that one sample happened to be one of the
    // ~17% of reports where column 5 isn't the larger value.
    wkshtCd: 'S300001',
    lineNum: '00100',
    clmnNum: '00500',
    plausibleRange: [0, 730_000]
  },
  {
    key: 'totalPatientRevenue',
    // CONFIRMED: Worksheet G-3, line 1 = total patient revenues (gross, before allowances).
    wkshtCd: 'G300000',
    lineNum: '00100',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'contractualAllowances',
    // CONFIRMED: Worksheet G-3, line 2 = contractual allowances and discounts (a deduction).
    wkshtCd: 'G300000',
    lineNum: '00200',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'netPatientRevenue',
    // CONFIRMED: Worksheet G-3, line 3 = net patient revenues (line 1 minus line 2).
    wkshtCd: 'G300000',
    lineNum: '00300',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'totalOperatingExpenses',
    // CONFIRMED: Worksheet G-3, line 4 = total operating expenses.
    wkshtCd: 'G300000',
    lineNum: '00400',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'netIncomeFromService',
    // CONFIRMED: Worksheet G-3, line 5 = net income from service to patients (line 3 minus line 4).
    // Negative when a facility loses money on patient care -- range allows it.
    wkshtCd: 'G300000',
    lineNum: '00500',
    clmnNum: '00100',
    plausibleRange: [-5_000_000_000, 5_000_000_000]
  },
  {
    key: 'otherIncome',
    // CONFIRMED: Worksheet G-3, line 25 = total other income (investments, misc revenue, etc.).
    wkshtCd: 'G300000',
    lineNum: '02500',
    clmnNum: '00100',
    plausibleRange: [-5_000_000_000, 5_000_000_000]
  },
  {
    key: 'totalIncome',
    // CONFIRMED: Worksheet G-3, line 26 = total income (line 5 plus line 25).
    wkshtCd: 'G300000',
    lineNum: '02600',
    clmnNum: '00100',
    plausibleRange: [-5_000_000_000, 5_000_000_000]
  },
  {
    key: 'otherExpense27',
    // CONFIRMED: Worksheet G-3, line 27 = first itemized "other expenses" line (its ALPHA label
    // says what it is, e.g. a facility's income-tax provision).
    wkshtCd: 'G300000',
    lineNum: '02700',
    clmnNum: '00100',
    plausibleRange: [-5_000_000_000, 5_000_000_000]
  },
  {
    key: 'otherExpense28',
    // CONFIRMED: Worksheet G-3, line 28 = second itemized other-expenses line. Some filers put
    // their only other-expense entry here rather than on line 27 (verified on real reports), so
    // the itemized block 27-30 is captured, not just line 27.
    wkshtCd: 'G300000',
    lineNum: '02800',
    clmnNum: '00100',
    plausibleRange: [-5_000_000_000, 5_000_000_000]
  },
  {
    key: 'otherExpense29',
    // CONFIRMED: Worksheet G-3, line 29 = third itemized other-expenses line.
    wkshtCd: 'G300000',
    lineNum: '02900',
    clmnNum: '00100',
    plausibleRange: [-5_000_000_000, 5_000_000_000]
  },
  {
    key: 'otherExpense30',
    // CONFIRMED: Worksheet G-3, line 30 = fourth itemized other-expenses line.
    wkshtCd: 'G300000',
    lineNum: '03000',
    clmnNum: '00100',
    plausibleRange: [-5_000_000_000, 5_000_000_000]
  },
  {
    key: 'netIncome',
    // CONFIRMED: Worksheet G-3, line 31 = net income (loss) for the period. Read directly from the
    // filed line now -- the previous derivation subtracted the wrong pair of cells and equaled the
    // negative of contractual allowances, not net income.
    wkshtCd: 'G300000',
    lineNum: '03100',
    clmnNum: '00100',
    plausibleRange: [-5_000_000_000, 5_000_000_000]
  },
  {
    key: 'cash',
    // CONFIRMED: Worksheet G (balance sheet), line 1, column 1 = cash on hand and in banks.
    wkshtCd: 'G000000',
    lineNum: '00100',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'accountsReceivable',
    // CONFIRMED: Worksheet G, line 4, column 1 = accounts receivable.
    wkshtCd: 'G000000',
    lineNum: '00400',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'totalCurrentAssets',
    // CONFIRMED: Worksheet G, line 11, column 1 = total current assets.
    wkshtCd: 'G000000',
    lineNum: '01100',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'totalAssets',
    // CONFIRMED: Worksheet G, line 34, column 1 = total assets.
    wkshtCd: 'G000000',
    lineNum: '03400',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'accountsPayable',
    // CONFIRMED: Worksheet G, line 35, column 1 = accounts payable.
    wkshtCd: 'G000000',
    lineNum: '03500',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'totalCurrentLiabilities',
    // CONFIRMED: Worksheet G, line 43, column 1 = total current liabilities.
    wkshtCd: 'G000000',
    lineNum: '04300',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'totalLongTermLiabilities',
    // CONFIRMED: Worksheet G, line 50, column 1 = total long-term liabilities.
    wkshtCd: 'G000000',
    lineNum: '05000',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'totalLiabilities',
    // CONFIRMED: Worksheet G, line 51, column 1 = total liabilities.
    wkshtCd: 'G000000',
    lineNum: '05100',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'fundBalance',
    // CONFIRMED: Worksheet G, line 52, column 1 = fund balance (equity). Negative equity exists
    // in the wild, so the range allows it.
    wkshtCd: 'G000000',
    lineNum: '05200',
    clmnNum: '00100',
    plausibleRange: [-5_000_000_000, 5_000_000_000]
  }
]

/** Metrics without which a facility-year record isn't worth emitting at all. */
export const REQUIRED_METRIC_KEYS = ['bedsAvailable', 'totalPatientDays'] as const
