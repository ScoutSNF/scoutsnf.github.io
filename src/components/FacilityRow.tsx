import { useState } from 'react'
import type { FacilityRecord } from '../types/facility'
import { TypeBadge } from './TypeBadge'
import { StarRating } from './StarRating'
import { PlaceholderImage } from './PlaceholderImage'
import { BookmarkIcon } from './BookmarkIcon'
import { InfoPopover } from './InfoPopover'
import { useLazyPlaceInfo } from '../hooks/useLazyPlaceInfo'
import { getOccupancyDisplay, getBedsDisplay, googleMapsDirectionsUrl, googleSearchUrl } from '../lib/facilityDisplay'

export function FacilityRow({
  facility,
  distanceMiles,
  saved,
  onToggleSave
}: {
  facility: FacilityRecord
  distanceMiles: number
  saved: boolean
  onToggleSave: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { ref, info } = useLazyPlaceInfo(facility.ccn, facility.name, facility.city, facility.state)
  const occupancy = getOccupancyDisplay(facility)
  const directionsUrl = googleMapsDirectionsUrl(facility)

  return (
    <div ref={ref} className="border-b border-slate-200 dark:border-slate-800">
      <button
        className="grid w-full grid-cols-[1.5rem_minmax(0,1fr)_2.1rem_1.6rem_2.9rem_2.9rem_1rem] items-center gap-1 px-1.5 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-900 sm:grid-cols-[1.75rem_minmax(0,1fr)_2.75rem_2.25rem_4rem_5rem_1.25rem] sm:gap-3 sm:px-3"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="h-7 w-7 shrink-0 overflow-hidden rounded-md bg-slate-200 dark:bg-slate-800">
          {info?.photoUrl ? (
            <img src={info.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <PlaceholderImage kind={facility.kind} name={facility.name} className="h-full w-full" />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            <span className="min-w-0 flex-1 truncate font-medium">{facility.name}</span>
            <span className="shrink-0">
              <TypeBadge facility={facility} />
            </span>
            {facility.kind === 'snf' && facility.specialFocusFacility && (
              <span className="shrink-0 whitespace-nowrap rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                SFF
              </span>
            )}
          </span>
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{facility.city}, {facility.state}</span>
        </span>
        <span className="text-right text-xs tabular-nums sm:text-sm">{distanceMiles.toFixed(2)} mi</span>
        <span className="text-right text-xs tabular-nums sm:text-sm">{getBedsDisplay(facility)}</span>
        <span className="flex flex-col items-end">
          <span className="text-xs tabular-nums sm:text-sm">{occupancy.text}</span>
          {occupancy.asOfLabel && (
            <span className={`text-right text-[9px] leading-tight sm:text-[10px] ${occupancy.historical ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              {occupancy.asOfLabel}
            </span>
          )}
        </span>
        <span className="flex justify-end overflow-hidden text-xs tabular-nums sm:hidden">
          {facility.overallRating != null ? `${facility.overallRating.toFixed(1)}★` : '—'}
        </span>
        <span className="hidden sm:flex sm:justify-end">
          <StarRating rating={facility.overallRating} />
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleSave()
          }}
          className={`justify-self-end text-base sm:text-lg ${saved ? 'text-gold' : 'text-slate-300 hover:text-gold dark:text-slate-600'}`}
          title={saved ? 'Remove from ScoutBoard' : 'Save to ScoutBoard'}
        >
          <BookmarkIcon filled={saved} />
        </button>
      </button>

      {expanded && (
        <div className="flex gap-4 bg-slate-50 px-3 py-3 dark:bg-slate-900/50">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800">
            {info?.photoUrl ? (
              <img src={info.photoUrl} alt={facility.name} className="h-full w-full object-cover" />
            ) : (
              <PlaceholderImage kind={facility.kind} name={facility.name} className="h-full w-full" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
              <span>{facility.name}</span>
              <TypeBadge facility={facility} />
              {facility.kind === 'snf' && facility.specialFocusFacility && (
                <span className="whitespace-nowrap rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  SFF
                </span>
              )}
            </div>
            <div className="text-slate-600 dark:text-slate-300">{facility.address}</div>
            <div className="text-slate-600 dark:text-slate-300">
              {facility.city}, {facility.state} {facility.zip}
            </div>
            {facility.kind === 'snf' && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
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
            {facility.kind === 'hospital' && facility.emergencyServices != null && (
              <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                Emergency services: {facility.emergencyServices ? 'Yes' : 'No'}
                <InfoPopover legendKey="hospital-emergency" />
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {info?.website ? (
                <a href={info.website} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline dark:text-sky-400">
                  Website ↗
                </a>
              ) : (
                <a
                  href={googleSearchUrl(facility)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-500 hover:underline dark:text-slate-400"
                >
                  Find online →
                </a>
              )}
              {directionsUrl && (
                <a href={directionsUrl} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline dark:text-sky-400">
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
