import { useMemo, useState } from 'react'
import type { FacilityRecord, SnfRecord, HospitalRecord } from '../types/facility'
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

  const hits = useMemo(() => searchFacilities(query, snfs, hospitals), [query, snfs, hospitals])

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Search a facility by name or city…"
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base shadow-sm focus:border-brand focus:outline-none dark:border-slate-700 dark:bg-slate-900"
      />
      {focused && hits.length > 0 && (
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
