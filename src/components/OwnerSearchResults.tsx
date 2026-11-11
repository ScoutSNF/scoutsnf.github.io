import { useEffect, useMemo, useState } from 'react'
import type { FacilityRecord, SnfRecord } from '../types/facility'
import { searchOwnersByNameAll, normalizeOwnerName, type OwnerSearchHit } from '../data/ownership'
import { formatRole, bareAssociationDate } from '../lib/ownershipDisplay'
import { titleCaseName } from '../lib/facilityDisplay'

interface FacilityMatch {
  facility: SnfRecord | null // null when the CCN isn't in the current roster (e.g. recently closed)
  ccn: string
  roles: string[]
  dates: string[]
  disclosures: string[]
}

/**
 * Full owner-search results: every facility whose CMS Ownership disclosure carries the exact
 * owner name searched, each row opening that facility's view. Matches are on the exact name
 * string: CMS publishes no unique owner ID, so one person can appear under several name strings,
 * one string can belong to different people, and roles differ by facility. Same-name matches are
 * leads, not confirmed identity.
 */
export function OwnerSearchResults({
  query,
  snfs,
  anchor,
  onOpen,
  onClose
}: {
  query: string
  snfs: SnfRecord[]
  anchor: FacilityRecord | null
  onOpen: (facility: FacilityRecord) => void
  onClose: () => void
}) {
  const [hits, setHits] = useState<OwnerSearchHit[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setHits(null)
    setError(false)
    searchOwnersByNameAll(query)
      .then((r) => {
        if (!cancelled) setHits(r)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [query])

  const snfByCcn = useMemo(() => new Map(snfs.map((f) => [f.ccn, f])), [snfs])

  const { exact, similarCount, exactQuery } = useMemo(() => {
    if (hits == null) return { exact: [] as FacilityMatch[], similarCount: 0, exactQuery: false }
    const wanted = normalizeOwnerName(query)
    const exactQuery = hits.some((h) => normalizeOwnerName(h.ownerName) === wanted)
    const byFac = new Map<string, { roles: Set<string>; dates: Set<string>; disclosures: Set<string> }>()
    let similar = 0
    const similarCcns = new Set<string>()
    for (const h of hits) {
      if (!h.ccn) continue
      if (exactQuery && normalizeOwnerName(h.ownerName) !== wanted) {
        if (!similarCcns.has(h.ccn)) similarCcns.add(h.ccn)
        continue
      }
      if (!byFac.has(h.ccn)) byFac.set(h.ccn, { roles: new Set(), dates: new Set(), disclosures: new Set() })
      const entry = byFac.get(h.ccn)!
      entry.disclosures.add([h.ownerName, h.role && formatRole(h.role), h.associationDate && `associated since ${bareAssociationDate(h.associationDate)}`].filter(Boolean).join(' · '))
      if (h.role) entry.roles.add(formatRole(h.role))
      if (h.associationDate) entry.dates.add(bareAssociationDate(h.associationDate))
    }
    similar = similarCcns.size
    const matches: FacilityMatch[] = [...byFac.entries()].map(([ccn, v]) => ({
      facility: snfByCcn.get(ccn) ?? null,
      ccn,
      roles: [...v.roles],
      dates: [...v.dates].sort(),
      disclosures: [...v.disclosures].sort()
    }))
    // The facility currently open comes first, then alphabetical by name -- the search usually
    // starts from the facility being viewed.
    matches.sort((a, b) => {
      if (anchor && a.ccn === anchor.ccn) return -1
      if (anchor && b.ccn === anchor.ccn) return 1
      return (a.facility?.name ?? a.ccn).localeCompare(b.facility?.name ?? b.ccn)
    })
    return { exact: matches, similarCount: similar, exactQuery }
  }, [hits, query, snfByCcn, anchor])

  return (
    <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-surface] p-4 shadow-[--shadow-sm]">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold">
          {error
            ? 'Owner search unavailable - try again'
            : hits == null
              ? `Searching for facilities listing “${query.trim()}”…`
              : exactQuery
                ? `${exact.length} ${exact.length === 1 ? 'facility lists' : 'facilities list'} the exact owner name “${normalizeOwnerName(query)}”`
                : `${exact.length} ${exact.length === 1 ? 'facility lists' : 'facilities list'} owner names matching “${query.trim()}”`}
        </h2>
        <button
          onClick={onClose}
          className="shrink-0 rounded-[--radius-md] border border-[--color-border-strong] px-2.5 py-1 text-xs font-medium text-[--color-text] hover:bg-[--color-surface-hover]"
        >
          Close
        </button>
      </div>

      {hits != null && !error && (
        <>
          <ul className="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {exact.map((m) => (
              <li key={m.ccn}>
                <button
                  className="flex w-full flex-col items-start gap-0.5 py-2 text-left hover:bg-slate-50 disabled:cursor-default dark:hover:bg-slate-800/50"
                  onClick={() => m.facility && onOpen(m.facility)}
                  disabled={!m.facility}
                >
                  <span className="text-sm font-medium text-[--color-text]">
                    {m.facility ? titleCaseName(m.facility.name) : `CCN ${m.ccn}`}
                    {anchor && m.ccn === anchor.ccn && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        this facility
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {m.facility ? `${m.facility.city}, ${m.facility.state}` : 'Not in the current roster'}
                    {exactQuery && m.roles.length > 0 && ` · ${m.roles.join(', ')}`}
                    {exactQuery && m.dates.length > 0 && ` · associated since ${m.dates.join(', ')}`}
                  </span>
                  {!exactQuery && m.disclosures.slice(0, 1).map((d) => (
                    <span key={d} className="max-w-full break-words text-xs text-slate-500 dark:text-slate-400">CMS: {d}</span>
                  ))}
                </button>
                {!exactQuery && m.disclosures.length > 1 && (
                  <details className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                    <summary className="cursor-pointer">{m.disclosures.length - 1} more matching CMS disclosures</summary>
                    <div className="mt-1 flex flex-col gap-1">
                      {m.disclosures.slice(1).map((d) => <p key={d} className="break-words">CMS: {d}</p>)}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {exact.length === 0 && (
            <p className="mt-2 text-sm text-[--color-text-secondary]">No facility lists a matching owner name.</p>
          )}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Each row opens that facility's view. Portfolio context stays inside the facility. {exactQuery ? 'Results use the exact name string.' : 'Results match owner-name text, not a confirmed person or organization.'} 
            CMS publishes no unique owner ID, so one person can appear under several name strings, one string can belong to different
            people, and roles differ by facility. Same-name matches are leads, not confirmed identity.
            {exactQuery && similarCount > 0 &&
              ` ${similarCount} more ${similarCount === 1 ? 'facility lists' : 'facilities list'} a similar but not identical name — not shown.`}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Source: CMS Ownership disclosures, queried live — the same dataset behind the owner field in Filters.
          </p>
        </>
      )}
    </section>
  )
          }
