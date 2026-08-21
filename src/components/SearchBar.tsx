import { useMemo, useState } from 'react'
import type { FacilityRecord, SnfRecord, HospitalRecord, FacilityKind } from '../types/facility'
import { searchFacilities } from '../lib/search'

export function SearchBar({
  snfs,
  hospitals,
  onSelect
}: {
  snfs: SnfRecord[]
  hospitals: HospitalRecord[]
  onSelect: (facility: FacilityRecord) => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [stateFilter, setStateFilter] = useState('')
  const [kindFilter, setKindFilter] = useState<FacilityKind | 'all'>('all')
  const [bedsMin, setBedsMin] = useState('')
  const [bedsMax, setBedsMax] = useState('')
  const [sffOnly, setSffOnly] = useState(false)

  const states = useMemo(() => [...new Set([...snfs, ...hospitals].map((f) => f.state))].sort(), [snfs, hospitals])

  const filters = useMemo(
    () => ({
      state: stateFilter || undefined,
      kind: kindFilter === 'all' ? undefined : kindFilter,
      bedsMin: bedsMin === '' ? undefined : Number(bedsMin),
      bedsMax: bedsMax === '' ? undefined : Number(bedsMax),
      sffOnly: sffOnly || undefined
    }),
    [stateFilter, kindFilter, bedsMin, bedsMax, sffOnly]
  )
  const activeFilterCount = [stateFilter, kindFilter !== 'all', bedsMin, bedsMax, sffOnly].filter(Boolean).length

  const hits = useMemo(() => searchFacilities(query, snfs, hospitals, filters), [query, snfs, hospitals, filters])
  const showResults = (focused || filtersOpen) && hits.length > 0

  function clearFilters() {
    setStateFilter('')
    setKindFilter('all')
    setBedsMin('')
    setBedsMax('')
    setSffOnly(false)
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search a facility by name, city, or ZIP…"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`relative shrink-0 rounded-lg border px-3 py-3 text-sm ${
            filtersOpen || activeFilterCount > 0
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'
          }`}
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {filtersOpen && (
        <div className="mt-2 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              State
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Any</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              Kind
              <div className="flex gap-1 rounded-md bg-slate-100 p-0.5 dark:bg-slate-800">
                {(['all', 'snf', 'hospital'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setKindFilter(k)
                      if (k === 'hospital') setSffOnly(false)
                    }}
                    className={`flex-1 rounded px-1.5 py-1 text-xs ${
                      kindFilter === k ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-slate-100' : ''
                    }`}
                  >
                    {k === 'all' ? 'All' : k === 'snf' ? 'SNF' : 'Hospital'}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              Beds min
              <input
                type="number"
                min={0}
                value={bedsMin}
                onChange={(e) => setBedsMin(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
              Beds max
              <input
                type="number"
                min={0}
                value={bedsMax}
                onChange={(e) => setBedsMax(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <label
              className={`flex items-center gap-1.5 text-xs ${
                kindFilter === 'hospital' ? 'text-slate-300 dark:text-slate-600' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={sffOnly}
                disabled={kindFilter === 'hospital'}
                onChange={(e) => setSffOnly(e.target.checked)}
                className="accent-brand"
              />
              Special Focus Facility only
            </label>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-sky-600 hover:underline dark:text-sky-400">
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {showResults && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {hits.map(({ facility }) => (
            <li key={`${facility.kind}:${facility.ccn}`}>
              <button
                className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                onMouseDown={() => {
                  onSelect(facility)
                  setQuery('')
                }}
              >
                <span className="font-medium">{facility.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {facility.city}, {facility.state} · CCN {facility.ccn} · {facility.kind === 'snf' ? 'SNF' : 'Hospital'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
