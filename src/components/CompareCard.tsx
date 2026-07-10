import type { FacilityRecord } from '../types/facility'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { BookmarkIcon } from './BookmarkIcon'
import { getBedsDisplay, getOccupancyDisplay } from '../lib/facilityDisplay'

function Column({
  facility,
  distanceLabel,
  saved,
  onToggleSave
}: {
  facility: FacilityRecord
  distanceLabel: string
  saved: boolean
  onToggleSave: () => void
}) {
  const occupancy = getOccupancyDisplay(facility)
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold">{facility.name}</span>
            <TypeBadge facility={facility} />
            {facility.kind === 'snf' && facility.specialFocusFacility && (
              <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                SFF
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{distanceLabel}</div>
        </div>
        <button
          onClick={onToggleSave}
          className={`shrink-0 text-lg ${saved ? 'text-gold' : 'text-slate-300 hover:text-gold'}`}
          title={saved ? 'Remove from Deal Board' : 'Save to Deal Board'}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-xs text-slate-400">Beds</dt>
          <dd className="tabular-nums">{getBedsDisplay(facility)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs text-slate-400">Occupancy</dt>
          <dd className="text-right tabular-nums">
            {occupancy.text}
            {occupancy.asOfLabel && (
              <span className={`ml-1 text-[10px] ${occupancy.historical ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                {occupancy.asOfLabel}
              </span>
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-xs text-slate-400">Rating</dt>
          <dd>
            <StarRating rating={facility.overallRating} />
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function CompareCard({
  anchor,
  facility,
  distanceMiles,
  savedIds,
  onToggleSave,
  onClose
}: {
  anchor: FacilityRecord
  facility: FacilityRecord
  distanceMiles: number
  savedIds: Set<string>
  onToggleSave: (facility: FacilityRecord) => void
  onClose: () => void
}) {
  return (
    <div className="rounded-xl border-2 border-brand/40 bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Comparing to anchor</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" title="Close comparison">
          ✕
        </button>
      </div>
      <div className="flex gap-4">
        <Column
          facility={anchor}
          distanceLabel="Anchor"
          saved={savedIds.has(`${anchor.kind}:${anchor.ccn}`)}
          onToggleSave={() => onToggleSave(anchor)}
        />
        <div className="w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
        <Column
          facility={facility}
          distanceLabel={`${distanceMiles.toFixed(2)} mi from anchor`}
          saved={savedIds.has(`${facility.kind}:${facility.ccn}`)}
          onToggleSave={() => onToggleSave(facility)}
        />
      </div>
    </div>
  )
}
