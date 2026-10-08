import { useState } from 'react'
import type { FacilityRecord } from '../types/facility'
import type { FacilityYearRecord } from '../types/costReport'
import { TypeBadge } from './TypeBadge'
import { SpecialFocusBadge } from './SpecialFocusBadge'
import { StarRating } from './StarRating'
import { PlaceholderImage } from './PlaceholderImage'
import { BookmarkIcon } from './BookmarkIcon'
import { InfoPopover } from './InfoPopover'
import { useLazyPlaceInfo } from '../hooks/useLazyPlaceInfo'
import { useOwnership } from '../hooks/useOwnership'
import { OwnershipDropdown } from './OwnershipDropdown'
import { getOccupancyDisplay, getBedsDisplay, googleMapsDirectionsUrl, googleSearchUrl, titleCaseName } from '../lib/facilityDisplay'

export function FacilityRow({
  facility,
  distanceMiles,
  saved,
  onToggleSave,
  costReportRecords,
  onCompare,
  onViewOnMap,
  onSelect,
  selected = false,
  showOccupancy = true,
  onAddToCompare,
  inCompare = false
}: {
  facility: FacilityRecord
  distanceMiles: number
  saved: boolean
  onToggleSave: () => void
  costReportRecords?: FacilityYearRecord[]
  onCompare?: () => void
  /** Highlights this facility on ScoutSNF's own map, distinct from the external "Open in Google Maps" link below. */
  onViewOnMap?: () => void
  /** Raised when this row becomes the open one, so the map can highlight the matching marker. */
  onSelect?: () => void
  /** True when this row is the shared selection -- set either from here or from a marker click. */
  selected?: boolean
  /** False when no row in this list has an occupancy figure, so the column is dropped rather than
   *  rendering a stripe of N/A that reads as missing work. */
  showOccupancy?: boolean
  onAddToCompare?: () => void
  inCompare?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next) onSelect?.()
  }
  const { ref, info } = useLazyPlaceInfo(facility.ccn, facility.name, facility.city, facility.state)
  const { records: ownership, loading: ownershipLoading, error: ownershipError } = useOwnership(
    facility.ccn,
    expanded && facility.kind === 'snf'
  )
  const occupancy = getOccupancyDisplay(facility)
  const latestCostReport = costReportRecords && costReportRecords.length > 0 ? costReportRecords[costReportRecords.length - 1] : null
  const occupancyText =
    facility.kind === 'hospital' && latestCostReport?.occupancyPct != null ? `${latestCostReport.occupancyPct}%` : occupancy.text
  const directionsUrl = googleMapsDirectionsUrl(facility)
  const displayName = titleCaseName(facility.name)

  return (
    <div ref={ref} className={`border-b border-[--color-border] ${selected ? 'bg-[--color-brand-subtle]' : ''}`}>
      {/* Phone: a card. Names wrap in full and every metric is labelled, replacing a seven-column
          grid that truncated most names to a few characters and shrank the as-of date to 9px. */}
      <button
        className="flex w-full flex-col gap-2 px-3 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-900 sm:hidden"
        onClick={toggle}
      >
        <span className="flex w-full items-start gap-2.5">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-md">
            {info?.photoUrl ? (
              <img src={info.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <PlaceholderImage kind={facility.kind} name={facility.name} className="h-full w-full" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">
              {displayName}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {facility.city}, {facility.state}
              </span>
              <TypeBadge facility={facility} />
              <SpecialFocusBadge facility={facility} />
            </span>
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              onToggleSave()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                onToggleSave()
              }
            }}
            className={`shrink-0 text-lg ${saved ? 'text-gold' : 'text-slate-500 hover:text-gold dark:text-slate-400'}`}
            title={saved ? 'Remove from ScoutBoard' : 'Save to ScoutBoard'}
          >
            <BookmarkIcon filled={saved} />
          </span>
        </span>

        <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-200">
          <span>
            <span className="text-slate-500 dark:text-slate-400">Distance </span>
            <span className="font-medium tabular-nums">{distanceMiles.toFixed(2)} mi</span>
          </span>
          <span>
            <span className="text-slate-500 dark:text-slate-400">Beds </span>
            <span className="font-medium tabular-nums">{getBedsDisplay(facility)}</span>
          </span>
          {showOccupancy && (
            <span>
              <span className="text-[--color-text-secondary]">Occupancy </span>
              <span className="font-medium tabular-nums">{occupancyText}</span>
              {facility.kind === 'snf' && occupancy.asOfLabel && (
                <span className="text-[--color-text-secondary]"> ({occupancy.asOfLabel})</span>
              )}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-500 dark:text-slate-400">Rating</span>
            <StarRating rating={facility.overallRating} />
          </span>
        </span>
      </button>

      {/* Desktop: the dense sortable table, which works well once there is room for it. */}
      <button
        className="hidden w-full grid-cols-[1.75rem_minmax(0,1fr)_2.75rem_2.25rem_4rem_5rem_1.25rem] items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-900 sm:grid"
        onClick={toggle}
      >
        <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md">
          {info?.photoUrl ? (
            <img src={info.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <PlaceholderImage kind={facility.kind} name={facility.name} className="h-full w-full" />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span className="min-w-0 flex-1 truncate font-medium" title={displayName}>
              {displayName}
            </span>
            <span className="shrink-0">
              <TypeBadge facility={facility} />
            </span>
            <SpecialFocusBadge facility={facility} className="shrink-0" />
          </span>
          <span className="truncate text-xs text-slate-600 dark:text-slate-300">
            {facility.city}, {facility.state}
          </span>
        </span>
        <span className="text-right text-sm tabular-nums">{distanceMiles.toFixed(2)} mi</span>
        <span className="text-right text-sm tabular-nums">{getBedsDisplay(facility)}</span>
        {showOccupancy ? (
          <span className="flex flex-col items-end">
            <span className="text-sm tabular-nums">{occupancyText}</span>
            {facility.kind === 'snf' && occupancy.asOfLabel && (
              <span className="text-right text-[10px] leading-tight text-[--color-text-muted]">{occupancy.asOfLabel}</span>
            )}
          </span>
        ) : (
          <span />
        )}
        <span className="flex justify-end">
          <StarRating rating={facility.overallRating} />
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onToggleSave()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onToggleSave()
            }
          }}
          className={`justify-self-end text-lg ${saved ? 'text-gold' : 'text-slate-500 hover:text-gold dark:text-slate-400'}`}
          title={saved ? 'Remove from ScoutBoard' : 'Save to ScoutBoard'}
        >
          <BookmarkIcon filled={saved} />
        </span>
      </button>

      {expanded && (
        <div className="flex gap-4 bg-slate-50 px-3 py-3 dark:bg-slate-900/50">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
            {info?.photoUrl ? (
              <img src={info.photoUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <PlaceholderImage kind={facility.kind} name={facility.name} className="h-full w-full" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
              <span>{displayName}</span>
              <TypeBadge facility={facility} />
              <SpecialFocusBadge facility={facility} />
            </div>
            <div className="text-slate-600 dark:text-slate-300">{facility.address}</div>
            <div className="text-slate-600 dark:text-slate-300">
              {facility.city}, {facility.state} {facility.zip}
            </div>
            {facility.kind === 'snf' && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="inline-flex items-center gap-1">Health inspection: <StarRating rating={facility.healthInspectionRating} /></span>
                <span className="inline-flex items-center gap-1">Staffing: <StarRating rating={facility.staffingRating} /></span>
                <span className="inline-flex items-center gap-1">Quality measures: <StarRating rating={facility.qualityMeasureRating} /></span>
                <InfoPopover legendKey="snf-sub-ratings" />
                {facility.ownershipType && (
                  <span className="inline-flex items-center gap-1">
                    Ownership: {facility.ownershipType}
                    <InfoPopover legendKey="snf-ownership" />
                  </span>
                )}
              </div>
            )}
            {facility.kind === 'snf' && (
              <OwnershipDropdown records={ownership} loading={ownershipLoading} error={ownershipError} />
            )}
            {facility.kind === 'hospital' && facility.emergencyServices != null && (
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                Emergency services: {facility.emergencyServices ? 'Yes' : 'No'}
                <InfoPopover legendKey="hospital-emergency" />
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {onCompare && (
                <button onClick={onCompare} className="text-sky-700 hover:underline dark:text-sky-300">
                  Compare to anchor
                </button>
              )}
              {onAddToCompare && (
                <button
                  onClick={onAddToCompare}
                  aria-pressed={inCompare}
                  className="text-sky-700 hover:underline dark:text-sky-300"
                >
                  {inCompare ? 'Remove from comparison' : 'Add to comparison'}
                </button>
              )}
              {onViewOnMap && (
                <button onClick={onViewOnMap} className="text-sky-700 hover:underline dark:text-sky-300">
                  View on map
                </button>
              )}
              {info?.website ? (
                <a href={info.website} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-300">
                  Website ↗
                </a>
              ) : (
                <a
                  href={googleSearchUrl(facility)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-600 hover:underline dark:text-slate-300"
                >
                  Find online →
                </a>
              )}
              {directionsUrl && (
                <a href={directionsUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline dark:text-sky-300">
                  Open in Google Maps ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
