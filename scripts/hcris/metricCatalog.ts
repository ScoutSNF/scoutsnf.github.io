import type { MetricDef } from './types.js'

/**
 * (WKSHT_CD, LINE_NUM, CLMN_NUM) coordinates for each metric we extract from the SNF-2010 form's
 * NMRC file.
 *
 * Confidence per field -- see scripts/hcris/README.md for the full trail and how to correct these:
 *   CONFIRMED  - verified against the real FY2025 SNF-2010 NMRC data (424 reports): either the
 *                per-column value distribution matches the field's real-world range (beds: 15-467,
 *                avg 110), or the cell reproduces an exact accounting identity across every report
 *                in the file (100% match, not a coincidence on one sample).
 *
 * LINE_NUM/CLMN_NUM use HCRIS's native 5-digit encoding: line 1 -> "00100", column 2 -> "00200"
 * (third position is the decimal boundary; sub-line/sub-column go after it).
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
    // CONFIRMED: Worksheet G-3, line 3.
    wkshtCd: 'G300000',
    lineNum: '00300',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'netPatientRevenue',
    // CONFIRMED: Worksheet G-3, line 4.
    wkshtCd: 'G300000',
    lineNum: '00400',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'totalOperatingExpenses',
    // CONFIRMED: Worksheet G-3, line 1.
    wkshtCd: 'G300000',
    lineNum: '00100',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  }
  // Net income is deliberately not extracted from a raw cell -- Worksheet G-3 line 5 ("00500")
  // looked plausible at a glance but turned out to be the contractual-allowance deduction
  // (rev - netRev), not net income; verified wrong on every sampled report. Net income is instead
  // derived downstream in buildRecord.ts as totalPatientRevenue - totalOperatingExpenses, which
  // exactly reproduces line 2 ("00200", negated) on all 405/405 reports checked.
]

/** Metrics without which a facility-year record isn't worth emitting at all. */
export const REQUIRED_METRIC_KEYS = ['bedsAvailable', 'totalPatientDays'] as const
