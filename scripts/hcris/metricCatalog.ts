import type { MetricDef } from './types.js'

/**
 * (WKSHT_CD, LINE_NUM, CLMN_NUM) coordinates for each metric we extract from the SNF-2010 form's
 * NMRC file.
 *
 * Confidence per field (researched without direct access to cms.gov -- see
 * scripts/hcris/README.md for the full trail and how to correct these):
 *   CONFIRMED   - independently verified against multiple secondary sources for the SNF-2010 form
 *                 specifically.
 *   BEST-EFFORT - sourced from secondary references that may describe the *hospital* 2552-10 form's
 *                 layout rather than the SNF-2010 form's own (they share worksheet names but not
 *                 line numbers -- confirmed by the one field where both were found and differed).
 *                 Treat these as a starting point to correct after reviewing real pipeline output,
 *                 not as verified fact.
 *
 * LINE_NUM/CLMN_NUM use HCRIS's native 5-digit encoding: line 1 -> "00100", column 2 -> "00200"
 * (third position is the decimal boundary; sub-line/sub-column go after it).
 *
 * Every value extracted via these coordinates still passes through validate.ts's plausibility and
 * cross-field checks before being trusted -- a wrong coordinate here should produce an
 * out-of-range or inconsistent value that gets caught and excluded, not a silently wrong number.
 */
export const METRIC_CATALOG: MetricDef[] = [
  {
    key: 'bedsAvailable',
    // CONFIRMED: SNF-2010 Worksheet S-3 Part I, line 1 = beds available.
    wkshtCd: 'S300001',
    lineNum: '00100',
    clmnNum: '00200',
    plausibleRange: [1, 2000]
  },
  {
    key: 'bedDaysAvailable',
    // BEST-EFFORT.
    wkshtCd: 'S300001',
    lineNum: '00100',
    clmnNum: '00600',
    plausibleRange: [365, 730_000]
  },
  {
    key: 'totalPatientDays',
    // BEST-EFFORT.
    wkshtCd: 'S300001',
    lineNum: '00800',
    clmnNum: '00700',
    plausibleRange: [0, 730_000]
  },
  {
    key: 'medicarePatientDays',
    // BEST-EFFORT.
    wkshtCd: 'S300001',
    lineNum: '00800',
    clmnNum: '00500',
    plausibleRange: [0, 730_000]
  },
  {
    key: 'medicaidPatientDays',
    // BEST-EFFORT.
    wkshtCd: 'S300001',
    lineNum: '00800',
    clmnNum: '00600',
    plausibleRange: [0, 730_000]
  },
  {
    key: 'totalPatientRevenue',
    // BEST-EFFORT.
    wkshtCd: 'G300000',
    lineNum: '00300',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'netPatientRevenue',
    // BEST-EFFORT.
    wkshtCd: 'G300000',
    lineNum: '00400',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'totalOperatingExpenses',
    // BEST-EFFORT.
    wkshtCd: 'G300000',
    lineNum: '00100',
    clmnNum: '00100',
    plausibleRange: [0, 5_000_000_000]
  },
  {
    key: 'netIncome',
    // BEST-EFFORT.
    wkshtCd: 'G300000',
    lineNum: '00500',
    clmnNum: '00100',
    plausibleRange: [-1_000_000_000, 1_000_000_000]
  }
]

/** Metrics without which a facility-year record isn't worth emitting at all. */
export const REQUIRED_METRIC_KEYS = ['bedsAvailable', 'totalPatientDays'] as const
