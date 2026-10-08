import type { ReactNode } from 'react'
import type { FacilityRecord } from '../types/facility'
import type { FacilityYearRecord } from '../types/costReport'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { SpecialFocusBadge } from './SpecialFocusBadge'
import { BookmarkIcon } from './BookmarkIcon'
import { InfoPopover } from './InfoPopover'
import type { LegendKey } from '../lib/legend'
import { titleCaseName, getOccupancyDisplay, getBedsDisplay } from '../lib/facilityDisplay'
import { useOwnership } from '../hooks/useOwnership'
import { OwnershipDropdown } from './OwnershipDropdown'
import { CopyLinkButton } from './CopyLinkButton'

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
  const { records: ownership, loading: ownershipLoading, error: ownershipError } = useOwnership(facility.ccn, facility.kind === 'snf')

  return (
    <div className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-surface] p-4 shadow-[--shadow-sm]">
      {/* Identity first, actions below it rather than crowded alongside -- at 390px a row of
          icon buttons beside a wrapping facility name squeezed the name to a few characters. */}
      <div className="flex flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold leading-tight text-[--color-text]">{titleCaseName(facility.name)}</h1>
              <TypeBadge facility={facility} />
              <SpecialFocusBadge facility={facility} long withInfo className="px-2" />
            </div>
            <p className="mt-0.5 text-sm text-[--color-text-secondary]">
              {facility.address}, {facility.city}, {facility.state} {facility.zip}
            </p>
            <p className="text-sm text-[--color-text-muted]">
              {facility.kind === 'snf' ? 'Skilled nursing facility' : facility.hospitalType} · CCN{' '}
              <span className="tabular-nums">{facility.ccn}</span>
            </p>
          </div>
          <button
            onClick={onToggleSave}
            aria-pressed={saved}
            className={`shrink-0 rounded-[--radius-md] p-2 text-2xl ${saved ? 'text-gold' : 'text-[--color-text-muted] hover:text-gold'}`}
            title={saved ? 'Remove from ScoutBoard' : 'Save to ScoutBoard'}
          >
            <BookmarkIcon filled={saved} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyLinkButton facility={facility} />
          {actions}
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

      {facility.kind === 'snf' && (
        <OwnershipDropdown records={ownership} loading={ownershipLoading} error={ownershipError} />
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
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
        {legendKey && <InfoPopover legendKey={legendKey} />}
      </div>
      <div className="font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-amber-600 dark:text-amber-400">{sub}</div>}
    </div>
  )
}
