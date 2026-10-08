import type { FacilityRecord } from '../types/facility'
import type { FacilityYearRecord } from '../types/costReport'
import { getBedsDisplay, getOccupancyDisplay, getCmsAsOf, formatDate, titleCaseName, getSpecialFocus } from '../lib/facilityDisplay'
import { StarRating } from './StarRating'
import { InfoPopover } from './InfoPopover'

export const MAX_COMPARE = 4

export interface CompareEntry {
  facility: FacilityRecord
  records?: FacilityYearRecord[]
}

type RowSpec = {
  label: string
  legendKey?: Parameters<typeof InfoPopover>[0]['legendKey']
  /** Returns the cell, or null when the metric does not apply to that facility's kind at all. */
  render: (e: CompareEntry) => React.ReactNode | null
  /** Shown under the label when the row's meaning differs by facility kind. */
  caveat?: (entries: CompareEntry[]) => string | null
}

function latest(records: FacilityYearRecord[] | undefined): FacilityYearRecord | null {
  return records && records.length > 0 ? records[records.length - 1] : null
}

const ROWS: RowSpec[] = [
  {
    label: 'Certified beds',
    render: (e) => <span className="tabular-nums">{getBedsDisplay(e.facility)}</span>
  },
  {
    label: 'Occupancy (CMS snapshot)',
    legendKey: 'snf-occupancy',
    render: (e) => {
      if (e.facility.kind !== 'snf') return null
      const occ = getOccupancyDisplay(e.facility)
      return (
        <span className="tabular-nums">
          {occ.text}
          {occ.asOfLabel && <span className="ml-1 text-xs text-[--color-text-muted]">{occ.asOfLabel}</span>}
        </span>
      )
    }
  },
  {
    label: 'Occupancy (cost report)',
    legendKey: 'cost-report-occupancy',
    render: (e) => {
      const r = latest(e.records)
      if (!r) return null
      return (
        <span className="tabular-nums">
          {r.occupancyPct != null ? `${r.occupancyPct}%` : 'N/A'}
          <span className="ml-1 text-xs text-[--color-text-muted]">FY{r.fyBeginDate.slice(2, 4)}</span>
        </span>
      )
    }
  },
  {
    label: 'CMS overall rating',
    render: (e) => <StarRating rating={e.facility.overallRating} showValue />,
    caveat: (entries) =>
      entries.some((e) => e.facility.kind === 'snf') && entries.some((e) => e.facility.kind === 'hospital')
        ? 'Nursing-home and hospital star ratings are separate CMS programs measuring different things. The scales are not equivalent.'
        : null
  },
  {
    label: 'Operating margin',
    legendKey: 'cost-report-margin',
    render: (e) => {
      const r = latest(e.records)
      if (!r) return null
      return (
        <span className="tabular-nums">
          {r.operatingMarginPct != null ? `${r.operatingMarginPct}%` : 'N/A'}
          <span className="ml-1 text-xs text-[--color-text-muted]">FY{r.fyBeginDate.slice(2, 4)}</span>
        </span>
      )
    }
  },
  {
    label: 'Medicaid mix',
    legendKey: 'cost-report-payer-mix',
    render: (e) => {
      const r = latest(e.records)
      if (!r) return null
      return (
        <span className="tabular-nums">
          {r.medicaidPct != null ? `${r.medicaidPct}%` : 'N/A'}
          <span className="ml-1 text-xs text-[--color-text-muted]">FY{r.fyBeginDate.slice(2, 4)}</span>
        </span>
      )
    }
  },
  {
    label: 'Special Focus',
    render: (e) => {
      if (e.facility.kind !== 'snf') return null
      const status = getSpecialFocus(e.facility)
      return <span>{status === 'sff' ? 'In the program' : status === 'candidate' ? 'Candidate' : 'No'}</span>
    }
  },
  {
    label: 'Ownership type',
    legendKey: 'snf-ownership',
    render: (e) => (e.facility.kind === 'snf' ? <span>{e.facility.ownershipType ?? 'N/A'}</span> : null)
  },
  {
    label: 'Hospital type',
    legendKey: 'hospital-type',
    render: (e) => (e.facility.kind === 'hospital' ? <span>{e.facility.hospitalType}</span> : null)
  },
  {
    label: 'Emergency services',
    legendKey: 'hospital-emergency',
    render: (e) =>
      e.facility.kind === 'hospital' ? (
        <span>{e.facility.emergencyServices == null ? 'N/A' : e.facility.emergencyServices ? 'Yes' : 'No'}</span>
      ) : null
  },
  {
    label: 'CMS data as of',
    render: (e) => {
      const asOf = getCmsAsOf(e.facility)
      return <span className="text-sm">{asOf ? formatDate(asOf) : 'No published date'}</span>
    }
  }
]

/**
 * Side-by-side comparison of 2-4 facilities.
 *
 * Rows that do not apply to a facility's kind render "Not applicable" rather than a blank or an
 * N/A: a hospital has no Special Focus status at all, which is a different fact from a SNF whose
 * status is unknown. Where SNFs and hospitals are compared together the rating row carries an
 * explicit note that the two star programs are not the same scale — the single most likely way a
 * reader would draw a false equivalence from this table.
 *
 * On mobile the identity column is pinned and the facility columns scroll horizontally inside
 * their own container, so the page itself never scrolls sideways.
 */
export function CompareTable({ entries }: { entries: CompareEntry[] }) {
  const visible = ROWS.filter((row) => entries.some((e) => row.render(e) !== null))

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="sr-only">Facility comparison</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 w-40 bg-[--color-surface] px-3 py-2 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]"
            >
              Metric
            </th>
            {entries.map((e) => (
              <th
                key={`${e.facility.kind}:${e.facility.ccn}`}
                scope="col"
                className="min-w-[10rem] border-b border-[--color-border] px-3 py-2 text-left align-bottom"
              >
                <span className="block font-semibold leading-snug text-[--color-text]">
                  {titleCaseName(e.facility.name)}
                </span>
                <span className="block text-xs font-normal text-[--color-text-secondary]">
                  {e.facility.city}, {e.facility.state} · CCN {e.facility.ccn}
                </span>
                <span className="block text-xs font-normal text-[--color-text-muted]">
                  {e.facility.kind === 'snf' ? 'Skilled nursing' : 'Hospital'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const caveat = row.caveat?.(entries) ?? null
            return (
              <tr key={row.label} className="border-b border-[--color-border] last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[--color-surface] px-3 py-2 text-left align-top font-normal text-[--color-text-secondary]"
                >
                  <span className="inline-flex items-center gap-1">
                    {row.label}
                    {row.legendKey && <InfoPopover legendKey={row.legendKey} />}
                  </span>
                  {caveat && <span className="mt-0.5 block text-xs text-[--color-caution]">{caveat}</span>}
                </th>
                {entries.map((e) => {
                  const cell = row.render(e)
                  return (
                    <td key={`${e.facility.kind}:${e.facility.ccn}`} className="px-3 py-2 align-top text-[--color-text]">
                      {cell ?? <span className="text-xs text-[--color-text-muted]">Not applicable</span>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
