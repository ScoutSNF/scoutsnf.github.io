import { useMemo, useState } from 'react'
import type { FacilityRecord, SnfRecord, HospitalRecord, FacilityKind } from '../types/facility'
import { searchFacilities, passesFilters, type SpecialFocusFilter, type StarFilter } from '../lib/search'
import { useOwnerNameSearch } from '../hooks/useOwnerNameSearch'
import { formatRole } from '../lib/ownershipDisplay'
import { titleCaseName } from '../lib/facilityDisplay'

interface OwnerMatch {
  facility: SnfRecord
  ownerName: string
  role: string
}

export function SearchBar({
  snfs,
  hospitals,
  onSelect,
  dataReady = true,
  loadError = null
}: {
  snfs: SnfRecord[]
  hospitals: HospitalRecord[]
  onSelect: (facility: FacilityRecord) => void
  /** True once the roster has loaded, so "no matches" can be told apart from "no data yet". */
  dataReady?: boolean
  /** Set when the roster could not be fetched, so a failure is not reported as an empty result. */
  loadError?: string | null
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [stateFilter, setStateFilter] = useState('')
  const [kindFilter, setKindFilter] = useState<FacilityKind | 'all'>('all')
  const [bedsMin, setBedsMin] = useState('')
  const [bedsMax, setBedsMax] = useState('')
  const [specialFocus, setSpecialFocus] = useState<SpecialFocusFilter | ''>('')
  const [minStars, setMinStars] = useState<StarFilter | ''>('')
  const [ownerQuery, setOwnerQuery] = useState('')

  // A min above a max silently returns nothing, which reads as "no such facilities exist" rather
  // than "these two numbers contradict each other". Flagged, and the range is not applied until fixed.
  const bedsRangeInvalid = bedsMin !== '' && bedsMax !== '' && Number(bedsMin) > Number(bedsMax)

  const states = useMemo(() => [...new Set([...snfs, ...hospitals].map((f) => f.state))].sort(), [snfs, hospitals])
  const snfByCcn = useMemo(() => new Map(snfs.map((f) => [f.ccn, f])), [snfs])

  const filters = useMemo(
    () => ({
      state: stateFilter || undefined,
      kind: kindFilter === 'all' ? undefined : kindFilter,
      bedsMin: bedsMin === '' || bedsRangeInvalid ? undefined : Number(bedsMin),
      bedsMax: bedsMax === '' || bedsRangeInvalid ? undefined : Number(bedsMax),
      specialFocus: specialFocus || undefined,
      minStars: minStars === '' ? undefined : minStars
    }),
    [stateFilter, kindFilter, bedsMin, bedsMax, specialFocus, minStars, bedsRangeInvalid]
  )

  /**
   * Active filters as removable chips. Built from the same values the query uses, so a chip can
   * never describe a filter that is not actually applied.
   */
  const chips = useMemo(() => {
    const out: { key: string; label: string; clear: () => void }[] = []
    if (stateFilter) out.push({ key: 'state', label: `State: ${stateFilter}`, clear: () => setStateFilter('') })
    if (kindFilter !== 'all')
      out.push({ key: 'kind', label: kindFilter === 'snf' ? 'SNFs only' : 'Hospitals only', clear: () => setKindFilter('all') })
    if (bedsMin) out.push({ key: 'bedsMin', label: `Beds ≥ ${bedsMin}`, clear: () => setBedsMin('') })
    if (bedsMax) out.push({ key: 'bedsMax', label: `Beds ≤ ${bedsMax}`, clear: () => setBedsMax('') })
    if (minStars !== '')
      out.push({
        key: 'stars',
        label: minStars === 'unrated' ? 'Unrated by CMS' : `${minStars}+ stars`,
        clear: () => setMinStars('')
      })
    if (specialFocus)
      out.push({
        key: 'sff',
        label:
          specialFocus === 'sff' ? 'Special Focus Facility' : specialFocus === 'candidate' ? 'SFF Candidate' : 'SFF or candidate',
        clear: () => setSpecialFocus('')
      })
    if (ownerQuery.trim()) out.push({ key: 'owner', label: `Owner: ${ownerQuery.trim()}`, clear: () => setOwnerQuery('') })
    return out
  }, [stateFilter, kindFilter, bedsMin, bedsMax, minStars, specialFocus, ownerQuery])

  const activeFilterCount = chips.length

  const { hits, total } = useMemo(() => searchFacilities(query, snfs, hospitals, filters), [query, snfs, hospitals, filters])

  // Same text, no filters. Only computed when a filtered search came back empty, so the common
  // path does not pay for a second pass over the roster.
  const unfilteredTotal = useMemo(() => {
    if (hits.length > 0 || query.trim().length < 2) return 0
    return searchFacilities(query, snfs, hospitals, {}, 1).total
  }, [hits.length, query, snfs, hospitals])

  // Ownership is a SNF-only CMS dataset -- no point querying it while the Kind filter is narrowed
  // to Hospital, or while the filters panel isn't even open to show a field for it.
  const ownerSearchEnabled = filtersOpen && kindFilter !== 'hospital'
  const { hits: ownerHitsRaw, loading: ownerLoading, error: ownerError } = useOwnerNameSearch(ownerQuery, ownerSearchEnabled)

  const ownerMatches = useMemo(() => {
    const byFacility = new Map<string, OwnerMatch>()
    for (const hit of ownerHitsRaw) {
      const facility = snfByCcn.get(hit.ccn)
      if (!facility || !passesFilters(facility, filters)) continue
      // A person/entity can hold multiple roles at one facility (e.g. an ownership stake and an
      // officer title) -- keep the first (highest-percentage, per the API's default ordering) so
      // one facility shows once per matching owner rather than once per role.
      const key = `${hit.ccn}:${hit.ownerName}`
      if (!byFacility.has(key)) byFacility.set(key, { facility, ownerName: hit.ownerName, role: hit.role })
    }
    return [...byFacility.values()]
  }, [ownerHitsRaw, snfByCcn, filters])

  // Whether the person has actually asked for something. Used to tell "nothing typed yet" apart
  // from "typed something that matched nothing" -- previously both rendered as no dropdown at
  // all, so a nonsense query looked identical to an untouched search box.
  const hasSearchIntent = query.trim().length >= 2 || activeFilterCount > 0
  const ownerPending = ownerSearchEnabled && ownerQuery.trim().length >= 3 && (ownerLoading || !!ownerError)
  const nothingFound = hasSearchIntent && hits.length === 0 && ownerMatches.length === 0 && !ownerPending

  /**
   * Four conditions that all used to render as the same blank dropdown. They mean different things
   * and need different next actions:
   *   'loading' — the roster has not arrived; nothing can be said about matches yet
   *   'error'   — the roster failed to load; this is not evidence that no facility matches
   *   'filtered'— the text matches something, but the active filters exclude it
   *   'none'    — nothing matches the text at all
   */
  const emptyReason: 'loading' | 'error' | 'filtered' | 'none' | null = !nothingFound
    ? null
    : loadError
      ? 'error'
      : !dataReady
        ? 'loading'
        : activeFilterCount > 0 && unfilteredTotal > 0
          ? 'filtered'
          : 'none'

  const noResults = nothingFound

  const showResults =
    (focused || filtersOpen) &&
    (hits.length > 0 || ownerMatches.length > 0 || ownerLoading || noResults || (ownerSearchEnabled && ownerQuery.trim().length >= 3 && ownerError))

  function clearFilters() {
    setStateFilter('')
    setKindFilter('all')
    setBedsMin('')
    setBedsMax('')
    setSpecialFocus('')
    setMinStars('')
    setOwnerQuery('')
  }

  function select(facility: FacilityRecord) {
    onSelect(facility)
    setQuery('')
    setOwnerQuery('')
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
          placeholder="Search by facility name, city, ZIP, or CCN…"
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

      {(chips.length > 0 || (hasSearchIntent && hits.length > 0)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {hasSearchIntent && hits.length > 0 && (
            <span className="text-sm tabular-nums text-[--color-text-secondary]">
              {total.toLocaleString()} result{total === 1 ? '' : 's'}
            </span>
          )}
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.clear}
              aria-label={`Remove filter: ${chip.label}`}
              className="inline-flex min-h-[1.75rem] items-center gap-1 rounded-[--radius-pill] border border-[--color-border-strong] bg-[--color-surface] px-2.5 py-1 text-xs font-medium text-[--color-text]"
            >
              {chip.label}
              <span aria-hidden="true" className="text-[--color-text-muted]">✕</span>
            </button>
          ))}
          {chips.length > 0 && (
            <button
              onClick={clearFilters}
              className="min-h-[1.75rem] px-1 text-xs font-medium text-[--color-brand-strong] underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

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
                      if (k === 'hospital') {
                        setSpecialFocus('')
                        setOwnerQuery('')
                      }
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

          {bedsRangeInvalid && (
            <p role="alert" className="-mt-1 text-sm text-[--color-negative]">
              Minimum beds is above maximum beds, so the bed range is not being applied.
            </p>
          )}

          <label className="flex flex-col gap-1 text-xs text-[--color-text-secondary]">
            Minimum CMS overall rating
            <select
              value={minStars === '' ? '' : String(minStars)}
              onChange={(e) => {
                const v = e.target.value
                setMinStars(v === '' ? '' : v === 'unrated' ? 'unrated' : (Number(v) as StarFilter))
              }}
              className="min-h-[2.5rem] rounded-[--radius-md] border border-[--color-border-strong] bg-[--color-surface] px-2 py-1.5 text-sm text-[--color-text]"
            >
              <option value="">Any rating</option>
              <option value="5">5 stars</option>
              <option value="4">4+ stars</option>
              <option value="3">3+ stars</option>
              <option value="2">2+ stars</option>
              <option value="1">1+ stars</option>
              <option value="unrated">Unrated by CMS</option>
            </select>
          </label>

          <label
            className={`flex flex-col gap-1 text-xs ${
              kindFilter === 'hospital' ? 'text-[--color-text-muted] opacity-60' : 'text-[--color-text-secondary]'
            }`}
          >
            Owner / manager / managing partner name <span className="font-normal">(SNFs only)</span>
            <input
              type="text"
              value={ownerQuery}
              disabled={kindFilter === 'hospital'}
              onChange={(e) => setOwnerQuery(e.target.value)}
              placeholder="e.g. Einhorn, or 150 Riverside Management…"
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900"
            />
          </label>

          <div className="flex items-end justify-between gap-3">
            <label
              className={`flex flex-1 flex-col gap-1 text-xs ${
                kindFilter === 'hospital' ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Special Focus status <span className="font-normal">(SNFs only)</span>
              <select
                value={specialFocus}
                disabled={kindFilter === 'hospital'}
                onChange={(e) => setSpecialFocus(e.target.value as SpecialFocusFilter | '')}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:disabled:bg-slate-900"
              >
                <option value="">Any</option>
                <option value="sff">Special Focus Facility</option>
                <option value="candidate">SFF Candidate</option>
                <option value="any">Either</option>
              </select>
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
        <ul className="absolute z-20 mt-1 max-h-96 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {noResults && (
            <li className="px-4 py-5 text-center">
              <p className="text-sm font-medium text-[--color-text]">
                {emptyReason === 'error'
                  ? 'Facility data unavailable'
                  : emptyReason === 'loading'
                    ? 'Still loading facilities…'
                    : 'No results'}
              </p>
              <p className="mt-1 text-sm text-[--color-text-secondary]">
                {emptyReason === 'error' ? (
                  <>The roster could not be loaded, so this is not a result — nothing could be searched. {loadError}</>
                ) : emptyReason === 'loading' ? (
                  <>Search will work once the roster finishes loading.</>
                ) : emptyReason === 'filtered' ? (
                  <>
                    “{query.trim()}” matches {unfilteredTotal.toLocaleString()} facilit
                    {unfilteredTotal === 1 ? 'y' : 'ies'}, but none pass the active filters.
                  </>
                ) : query.trim().length >= 2 ? (
                  <>Nothing matches “{query.trim()}”. Search looks at facility name, city, ZIP and exact CCN.</>
                ) : (
                  <>No facilities match the active filters.</>
                )}
              </p>
              {emptyReason === 'filtered' && (
                <button
                  onMouseDown={clearFilters}
                  className="mt-2 min-h-[2.25rem] text-sm font-medium text-[--color-brand-strong] underline-offset-2 hover:underline"
                >
                  Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
                </button>
              )}
            </li>
          )}
          {hits.map(({ facility }) => (
            <li key={`${facility.kind}:${facility.ccn}`}>
              <button
                className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                onMouseDown={() => select(facility)}
              >
                <span className="font-medium">{titleCaseName(facility.name)}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {facility.city}, {facility.state} · CCN {facility.ccn} · {facility.kind === 'snf' ? 'SNF' : 'Hospital'}
                </span>
              </button>
            </li>
          ))}

          {/* Not a caption -- without it a capped list is indistinguishable from a complete one,
              which is the one thing you cannot infer from the rows themselves. */}
          {total > hits.length && (
            <li className="border-t border-slate-200 px-4 py-1.5 text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Showing {hits.length} of {total.toLocaleString()}
            </li>
          )}

          {ownerSearchEnabled && ownerQuery.trim().length >= 3 && (
            <>
              <li className="border-t border-slate-200 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Owners matching “{ownerQuery.trim()}”
              </li>
              {ownerLoading && <li className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">Searching…</li>}
              {ownerError && (
                <li className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">Owner search unavailable — try again</li>
              )}
              {!ownerLoading && !ownerError && ownerMatches.length === 0 && (
                <li className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">No matching owners found</li>
              )}
              {ownerMatches.map(({ facility, ownerName, role }) => (
                <li key={`owner:${facility.ccn}:${ownerName}`}>
                  <button
                    className="flex w-full flex-col items-start px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                    onMouseDown={() => select(facility)}
                  >
                    <span className="font-medium">{titleCaseName(facility.name)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {facility.city}, {facility.state} · CCN {facility.ccn}
                    </span>
                    <span className="text-xs text-brand">
                      {ownerName}
                      {role && <span className="text-slate-500 dark:text-slate-400"> — {formatRole(role)}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  )
}
