import type { HospitalType } from '../types/facility'

/**
 * CMS "Hospital Type" free-text values → badge labels. Matched loosely because
 * CMS has varied punctuation/casing across refreshes (e.g. "Acute Care Hospitals"
 * vs "Acute Care - Veterans Administration").
 */
const RULES: Array<[RegExp, HospitalType]> = [
  [/veterans/i, 'VA'],
  [/department of defense|\bdod\b/i, 'DoD'],
  [/critical access/i, 'Critical Access'],
  [/psychiatric/i, 'Psychiatric'],
  [/child/i, "Children's"],
  [/long term care/i, 'LTCH'],
  [/rehab/i, 'Inpatient Rehab'],
  [/acute care/i, 'Acute Care']
]

export function classifyHospitalType(raw: string | null | undefined): HospitalType {
  if (!raw) return 'Other'
  for (const [pattern, label] of RULES) {
    if (pattern.test(raw)) return label
  }
  return 'Other'
}

export const HOSPITAL_TYPE_BADGE_COLOR: Record<HospitalType, string> = {
  'Acute Care': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'Critical Access': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  Psychiatric: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300',
  "Children's": 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
  VA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  DoD: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
  LTCH: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  'Inpatient Rehab': 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  Other: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
}
