import { useMemo, useState } from 'react'
import type { FacilityRecord, FacilityWithDistance } from '../types/facility'
import type { FacilityYearRecord } from '../types/costReport'
import { FacilityRow } from './FacilityRow'

type SortKey = 'distance' | 'name' | 'beds' | 'occupancy' | 'rating'

export function ResultsSection({
  title,
  items,
  savedIds,
  onToggleSave,
  costReportsByCcn,
  onCompare,
  onViewOnMap
}: {
  title?: string
  items: FacilityWithDistance<FacilityRecord>[]
  savedIds: Set<string>
  onToggleSave: (facility: FacilityRecord) => void
  costReportsByCcn?: Map<string, FacilityYearRecord[]>
  onCompare?: (facility: FacilityRecord, distanceMiles: number) => void
  onViewOnMap?: (facility: FacilityRecord, distanceMiles: number) => void
}) {
  const [sortKey, setSortKey] = useState<SortKey>('distance')
  const [asc, setAsc] = useState(true)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(({ facility }) => facility.name.toLowerCase().includes(q))
  }, [items, search])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let diff = 0
      switch (sortKey) {
        case 'distance':
          diff = a.distanceMiles - b.distanceMiles
          break
        case 'name':
          diff = a.facility.name.localeCompare(b.facility.name)
          break
        case 'beds':
          diff = (a.facility.certifiedBeds ?? -1) - (b.facility.certifiedBeds ?? -1)
          break
        case 'occupancy':
          diff = (a.facility.occupancyPct ?? -1) - (b.facility.occupancyPct ?? -1)
          break
        case 'rating':
          diff = (a.facility.overallRating ?? -1) - (b.facility.overallRating ?? -1)
          break
      }
      return asc ? diff : -diff
    })
    return copy
  }, [filtered, sortKey, asc])

  function handleSort(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(true)
    }
  }

  const sortBtn = (key: SortKey, label: string, extraClass = '', title?: string) => (
    <button
      onClick={() => handleSort(key)}
      title={title}
      className={`truncate whitespace-nowrap text-left text-[10px] font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-50 sm:text-xs ${extraClass}`}
    >
      {label}
      {sortKey === key ? (asc ? ' ▲' : ' ▼') : ''}
    </button>
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {title && (
        <h2 className="border-b border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-800">
          {title} ({items.length})
        </h2>
      )}
      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-slate-600 dark:text-slate-300">None within this radius</p>
      ) : (
        <>
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search these results by name…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          {/* Phone: column headers make no sense over cards, so sorting becomes an explicit
              control instead of a row of clickable table headings. */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs dark:border-slate-800 sm:hidden">
            <span className="text-slate-600 dark:text-slate-300">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey)
                setAsc(true)
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="distance">Distance</option>
              <option value="name">Name</option>
              <option value="beds">Beds</option>
              <option value="occupancy">Occupancy</option>
              <option value="rating">Rating</option>
            </select>
            <button
              onClick={() => setAsc((v) => !v)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
              title={asc ? 'Ascending' : 'Descending'}
            >
              {asc ? '▲ Asc' : '▼ Desc'}
            </button>
          </div>

          <div className="hidden grid-cols-[1.75rem_minmax(0,1fr)_2.75rem_2.25rem_4rem_5rem_1.25rem] items-center gap-3 border-b border-slate-100 px-3 py-1.5 dark:border-slate-800 sm:grid">
            <span />
            {sortBtn('name', 'Name')}
            {sortBtn('distance', 'Dist.', 'text-right', 'Straight-line distance, not drive time')}
            {sortBtn('beds', 'Beds', 'text-right')}
            {sortBtn('occupancy', 'Occ.', 'text-right')}
            {sortBtn('rating', 'Rating', 'text-right')}
            <span />
          </div>
          {sorted.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-600 dark:text-slate-300">No results for “{search}” in this list</p>
          ) : (
            <div>
              {sorted.map(({ facility, distanceMiles }) => (
                <FacilityRow
                  key={facility.ccn}
                  facility={facility}
                  distanceMiles={distanceMiles}
                  saved={savedIds.has(`${facility.kind}:${facility.ccn}`)}
                  onToggleSave={() => onToggleSave(facility)}
                  costReportRecords={costReportsByCcn?.get(facility.ccn)}
                  onCompare={onCompare ? () => onCompare(facility, distanceMiles) : undefined}
                  onViewOnMap={onViewOnMap ? () => onViewOnMap(facility, distanceMiles) : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
