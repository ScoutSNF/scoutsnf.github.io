import type { FacilityRecord } from '../types/facility'
import { getSpecialFocus, SPECIAL_FOCUS_LABEL } from '../lib/facilityDisplay'
import { InfoPopover } from './InfoPopover'

// Red is reserved for facilities actually in the program; candidates get amber. They carry
// genuinely different risk -- an SFF faces termination exposure, a candidate is on a watch list --
// so they must not read as the same signal at a glance.
const COLOR = {
  sff: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  candidate: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
} as const

const LEGEND_KEY = { sff: 'snf-sff', candidate: 'snf-sff-candidate' } as const

export function SpecialFocusBadge({
  facility,
  long = false,
  withInfo = false,
  className = ''
}: {
  facility: FacilityRecord
  long?: boolean
  withInfo?: boolean
  className?: string
}) {
  if (facility.kind !== 'snf') return null
  const status = getSpecialFocus(facility)
  if (!status) return null

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${COLOR[status]} ${className}`}
    >
      {long ? SPECIAL_FOCUS_LABEL[status].long : SPECIAL_FOCUS_LABEL[status].short}
      {withInfo && <InfoPopover legendKey={LEGEND_KEY[status]} />}
    </span>
  )
}
