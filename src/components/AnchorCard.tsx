import type { ReactNode } from 'react'
import type { FacilityRecord } from '../types/facility'
import type { FacilityYearRecord } from '../types/costReport'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { BookmarkIcon } from './BookmarkIcon'
import { InfoPopover } from './InfoPopover'
import type { LegendKey } from '../lib/legend'
import { getOccupancyDisplay, getBedsDisplay } from '../lib/facilityDisplay'

export function AnchorCard({
  facility,
  saved,
  onToggleSave,
  actions,
  costReportRecords
}: {
  facility: FacilityRecord
  saved: boolean
  onToggleSave: () => void
  actions?: ReactNode
  /** Same records shown in CostReportCard -- used here only to keep the hospital Occupancy stat
   * from showing a stale N/A when the Cost Report card right below it clearly has the number. */
  costReportRecords?: FacilityYearRecord[]
}) {
  const occupancy = getOccupancyDisplay(facility)
  const latestCostReport = costReportRecords && costReportRecords.length > 0 ? costReportRecords[costReportRecords.length - 1] : null
  const hospitalOccupancyText =
    facility.kind === 'hospital' && latestCostReport?.occupancyPct != null ? `${latestCostReport.occupancyPct}%` : occupancy.text

  return (
    <div className="rounded-xl border-2 border-brand/40 bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">{facility.name}</h1>
            <TypeBadge facility={facility} />
            {facility.kind === 'snf' && facility.specialFocusFacility && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                Special Focus Facility
                <InfoPopover legendKey="snf-sff" />
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {facility.address}, {facility.city}, {facility.state} {facility.zip} · CCN {facility.ccn}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            onClick={onToggleSave}
            className={`text-2xl ${saved ? 'text-gold' : 'text-slate-300 hover:text-gold'}`}
            title={saved ? 'Remove from ScoutBoard' : 'Save to ScoutBoard'}
          >
            <BookmarkIcon filled={saved} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Certified beds" legendKey={facility.kind === 'snf' ? 'snf-beds' : 'hospital-beds'} value={getBedsDisplay(facility)} />
        <Metric
          label="Occupancy"
          legendKey={facility.kind === 'snf' ? 'snf-occupancy' : latestCostReport ? 'cost-report-occupancy' : undefined}
          value={hospitalOccupancyText}
          sub={facility.kind === 'snf' ? occupancy.asOfLabel : null}
        />
        <Metric label="Overall rating" legendKey={facility.kind === 'snf' ? 'snf-overall-rating' : 'hospital-overall-rating'} value={<StarRating rating={facility.overallRating} />} />
        {facility.kind === 'snf' ? (
          <Metric label="Ownership" legendKey="snf-ownership" value={facility.ownershipType ?? 'N/A'} />
        ) : (
          <Metric label="Emergency services" legendKey="hospital-emergency" value={facility.emergencyServices ? 'Yes' : facility.emergencyServices === false ? 'No' : 'N/A'} />
        )}
      </div>

      {facility.kind === 'snf' && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            Health inspection: <StarRating rating={facility.healthInspectionRating} />
          </span>
          <span className="inline-flex items-center gap-1">
            Staffing: <StarRating rating={facility.staffingRating} />
          </span>
          <span className="inline-flex items-center gap-1">
            Quality measures: <StarRating rating={facility.qualityMeasureRating} />
          </span>
          <InfoPopover legendKey="snf-sub-ratings" />
          {facility.processingDate && <span>Data as of {facility.processingDate}</span>}
        </div>
      )}
    </div>
  )
}

function Metric({
  label,
  legendKey,
  value,
  sub
}: {
  label: string
  legendKey?: LegendKey
  value: ReactNode
  sub?: string | null
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
        {legendKey && <InfoPopover legendKey={legendKey} />}
      </div>
      <div className="font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-amber-600 dark:text-amber-400">{sub}</div>}
    </div>
  )
}
