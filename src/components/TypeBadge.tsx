import type { FacilityRecord } from '../types/facility'
import { HOSPITAL_TYPE_BADGE_COLOR } from '../lib/hospitalType'

export function TypeBadge({ facility }: { facility: FacilityRecord }) {
  if (facility.kind === 'snf') {
    // SNF is the default/expected kind in this app (every facility here is a
    // SNF unless labeled otherwise) — only badge what's actually distinctive,
    // like Special Focus Facility status, which is already shown separately.
    return null
  }
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${HOSPITAL_TYPE_BADGE_COLOR[facility.hospitalType]}`}
    >
      {facility.hospitalType}
    </span>
  )
}
