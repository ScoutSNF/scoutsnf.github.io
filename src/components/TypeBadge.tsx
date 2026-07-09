import type { FacilityRecord } from '../types/facility'
import { HOSPITAL_TYPE_BADGE_COLOR } from '../lib/hospitalType'

export function TypeBadge({ facility }: { facility: FacilityRecord }) {
  if (facility.kind === 'snf') {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
        SNF
      </span>
    )
  }
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${HOSPITAL_TYPE_BADGE_COLOR[facility.hospitalType]}`}
    >
      {facility.hospitalType}
    </span>
  )
}
