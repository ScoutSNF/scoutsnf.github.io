import { useMemo, useState } from 'react'
import type { SavedFacilityRow } from '../data/db'
import type { FacilityRecord, SnfRecord, HospitalRecord } from '../types/facility'
import { titleCaseName, getBedsDisplay, getOccupancyDisplay, getCmsAsOf, formatDate } from '../lib/facilityDisplay'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { SpecialFocusBadge } from './SpecialFocusBadge'
import { MapView } from './MapView'

export type BoardView = 'table' | 'cards' | 'map'

export interface ResolvedSaved {
  row: SavedFacilityRow
  facility: FacilityRecord | undefined
}

/**
 * Three views over one set of saved records.
 *
 * Deliberately not three separate data paths: the caller resolves the rows once and every view
 * renders the same array, so switching view cannot change which facilities are shown, their order,
 * or the compare selection. Sort order lives here and is shared by table and cards; the map plots
 * the same list.
 */
export function BoardViews({
  items,
  view,
  onViewChange,
  onOpen,
  onRemove,
  compareIds,
  onToggleCompare
}: {
  items: ResolvedSaved[]
  view: BoardView
  onViewChange: (v: BoardView) => void
  onOpen: (facility: FacilityRecord, radiusMiles: number) => void
  onRemove: (row: SavedFacilityRow) => void
  compareIds: Set<string>
  onToggleCompare: (facility: FacilityRecord) => void
}) {
  const [sortKey, setSortKey] = useState<'order' | 'name' | 'beds' | 'rating'>('order')

  const sorted = useMemo(() => {
    const copy = [...items]
    if (sortKey === 'name') copy.sort((a, b) => a.row.name.localeCompare(b.row.name))
    else if (sortKey === 'beds')
      copy.sort((a, b) => (b.facility?.certifiedBeds ?? -1) - (a.facility?.certifiedBeds ?? -1))
    else if (sortKey === 'rating')
      copy.sort((a, b) => (b.facility?.overallRating ?? -1) - (a.facility?.overallRating ?? -1))
    return copy
  }, [items, sortKey])

  const mappable = useMemo(
    () =>
      sorted
        .map((i) => i.facility)
        .filter((f): f is SnfRecord | HospitalRecord => !!f && f.latitude != null && f.longitude != null),
    [sorted]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="ScoutBoard view" className="flex gap-1 rounded-[--radius-md] bg-[--color-surface-sunken] p-0.5">
          {(['table', 'cards', 'map'] as BoardView[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => onViewChange(v)}
              className={`min-h-[2.25rem] rounded-[--radius-sm] px-3 py-1.5 text-sm font-medium capitalize ${
                view === v ? 'bg-[--color-surface] text-[--color-text] shadow-[--shadow-sm]' : 'text-[--color-text-secondary]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {view !== 'map' && (
          <label className="flex items-center gap-2 text-sm text-[--color-text-secondary]">
            Sort
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
              className="min-h-[2.25rem] rounded-[--radius-md] border border-[--color-border-strong] bg-[--color-surface] px-2 py-1 text-sm text-[--color-text]"
            >
              <option value="order">Manual order</option>
              <option value="name">Name</option>
              <option value="beds">Beds</option>
              <option value="rating">CMS rating</option>
            </select>
          </label>
        )}
      </div>

      {view === 'map' ? (
        mappable.length === 0 ? (
          <p className="rounded-[--radius-lg] border border-[--color-border] p-6 text-center text-sm text-[--color-text-secondary]">
            None of your saved facilities have published coordinates, so there is nothing to plot.
          </p>
        ) : (
          <div className="h-[28rem] overflow-hidden rounded-[--radius-lg] border border-[--color-border]">
            <MapView
              anchor={mappable[0]}
              radiusMiles={0}
              results={mappable.map((f) => ({ facility: f, distanceMiles: 0 }))}
              onSelect={(facility) => {
                const match = sorted.find((i) => i.facility && i.facility.ccn === facility.ccn)
                if (match?.facility) onOpen(match.facility, match.row.radiusMiles)
              }}
            />
          </div>
        )
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-[--radius-lg] border border-[--color-border]">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[--color-border] text-left text-xs uppercase tracking-wide text-[--color-text-muted]">
                <th scope="col" className="px-3 py-2">Facility</th>
                <th scope="col" className="px-3 py-2 text-right">Beds</th>
                <th scope="col" className="px-3 py-2 text-right">Occupancy</th>
                <th scope="col" className="px-3 py-2 text-right">Rating</th>
                <th scope="col" className="px-3 py-2">CMS as of</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ row, facility }) => {
                const occ = facility ? getOccupancyDisplay(facility) : null
                const asOf = facility ? getCmsAsOf(facility) : null
                return (
                  <tr key={row.id} className="border-b border-[--color-border] last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <button
                        onClick={() => facility && onOpen(facility, row.radiusMiles)}
                        className="text-left font-medium text-[--color-text] hover:underline"
                      >
                        {titleCaseName(row.name)}
                      </button>
                      <span className="block text-xs text-[--color-text-secondary]">
                        {row.city}, {row.state}
                      </span>
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{facility ? getBedsDisplay(facility) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{occ?.text ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex justify-end">
                        <StarRating rating={facility?.overallRating ?? null} showValue />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[--color-text-secondary]">
                      {asOf ? formatDate(asOf) : 'No published date'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {facility && (
                          <button
                            onClick={() => onToggleCompare(facility)}
                            aria-pressed={compareIds.has(row.id)}
                            className="text-xs font-medium text-[--color-brand-strong] hover:underline"
                          >
                            {compareIds.has(row.id) ? 'In comparison' : 'Compare'}
                          </button>
                        )}
                        <button
                          onClick={() => onRemove(row)}
                          aria-label={`Remove ${titleCaseName(row.name)} from ScoutBoard`}
                          className="text-xs text-[--color-text-muted] hover:text-[--color-negative]"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map(({ row, facility }) => {
            const occ = facility ? getOccupancyDisplay(facility) : null
            const asOf = facility ? getCmsAsOf(facility) : null
            return (
              <li key={row.id} className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-surface] p-3">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => facility && onOpen(facility, row.radiusMiles)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block font-semibold leading-snug text-[--color-text]">{titleCaseName(row.name)}</span>
                    <span className="block text-xs text-[--color-text-secondary]">
                      {row.city}, {row.state}
                    </span>
                  </button>
                  {facility && (
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      <TypeBadge facility={facility} />
                      <SpecialFocusBadge facility={facility} />
                    </span>
                  )}
                </div>

                <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-[--color-text-muted]">Beds</dt>
                    <dd className="font-medium tabular-nums">{facility ? getBedsDisplay(facility) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[--color-text-muted]">Occupancy</dt>
                    <dd className="font-medium tabular-nums">{occ?.text ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[--color-text-muted]">Rating</dt>
                    <dd><StarRating rating={facility?.overallRating ?? null} showValue /></dd>
                  </div>
                </dl>

                <p className="mt-2 text-xs text-[--color-text-muted]">
                  {asOf ? `CMS data as of ${formatDate(asOf)}` : 'No published CMS date'} · Saved {formatDate(row.savedAt)}
                </p>

                <div className="mt-2 flex gap-3">
                  {facility && (
                    <button
                      onClick={() => onToggleCompare(facility)}
                      aria-pressed={compareIds.has(row.id)}
                      className="text-xs font-medium text-[--color-brand-strong] hover:underline"
                    >
                      {compareIds.has(row.id) ? 'In comparison' : 'Compare'}
                    </button>
                  )}
                  <button onClick={() => onRemove(row)} className="text-xs text-[--color-text-muted] hover:text-[--color-negative]">
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
