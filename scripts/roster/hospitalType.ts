import type { HospitalType } from './types.js'

/**
 * CMS "Hospital Type" free-text values -> badge labels. Matched loosely because CMS has varied
 * punctuation/casing across refreshes. Port of src/lib/hospitalType.ts's classifier (the
 * app-only badge-color map isn't needed here).
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
