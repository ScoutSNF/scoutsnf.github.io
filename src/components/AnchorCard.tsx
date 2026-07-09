import type { ReactNode } from 'react'
import type { FacilityRecord } from '../types/facility'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { getOccupancyDisplay, getBedsDisplay } from '../lib/facilityDisplay'

export function AnchorCard({
  facility,
  snapshotLine,
  saved,
  onToggleSave
}: {
  facility: FacilityRecord
  snapshotLine: string
  saved: boolean
  onToggleSave: () => void
}) {
  const occupancy = getOccupancyDisplay(facility)

  return (
    <div className="rounded-xl border-2 border-brand/40 bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">{facility.name}</h1>
            <TypeBadge facility={facility} />
            {facility.kind === 'snf' && facility.specialFocusFacility && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                Special Focus Facility
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {facility.address}, {facility.city}, {facility.state} {facility.zip} · CCN {facility.ccn}
          </p>
        </div>
        <button
          onClick={onToggleSave}
          className={`text-2xl ${saved ? 'text-gold' : 'text-slate-300 hover:text-gold'}`}
          title={saved ? 'Remove from Deal Board' : 'Save to Deal Board'}
        >
          {saved ? '★' : '☆'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Certified beds" value={getBedsDisplay(facility)} />
        <Metric label="Occupancy" value={occupancy.text} sub={occupancy.asOfLabel} />
        <Metric label="Overall rating" value={<StarRating rating={facility.overallRating} />} />
        {facility.kind === 'snf' ? (
          <Metric label="Ownership" value={facility.ownershipType ?? 'N/A'} />
        ) : (
          <Metric label="Emergency services" value={facility.emergencyServices ? 'Yes' : facility.emergencyServices === false ? 'No' : 'N/A'} />
        )}
      </div>

      {facility.kind === 'snf' && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>Health inspection: <StarRating rating={facility.healthInspectionRating} /></span>
          <span>Staffing: <StarRating rating={facility.staffingRating} /></span>
          <span>Quality measures: <StarRating rating={facility.qualityMeasureRating} /></span>
          {facility.processingDate && <span>Data as of {facility.processingDate}</span>}
        </div>
      )}

      <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium dark:bg-slate-800">{snapshotLine}</p>
    </div>
  )
}

function Metric({ label, value, sub }: { label: string; value: ReactNode; sub?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
      <div className="font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-amber-600 dark:text-amber-400">{sub}</div>}
    </div>
  )
}
