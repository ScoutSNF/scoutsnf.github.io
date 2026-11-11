import { useEffect, useMemo, useState } from 'react'
import type { FacilityRecord, SnfRecord } from '../types/facility'
import { useOwnership } from '../hooks/useOwnership'
import { loadChowData, type ChowData } from '../data/chow'
import { searchOwnersByNameAll, normalizeOwnerName, type OwnershipRecord } from '../data/ownership'
import { formatRole, bareAssociationDate } from '../lib/ownershipDisplay'
import { titleCaseName } from '../lib/facilityDisplay'

function isDirectOwner(role: string): boolean {
  return role.toUpperCase().includes('DIRECT OWNERSHIP')
}

function shortRole(role: string): string {
  const r = role.toUpperCase()
  if (r.includes('5% OR GREATER DIRECT OWNERSHIP INTEREST')) return 'Direct owner'
  return formatRole(role)
}

/**
 * One row per disclosed ownership/control relationship, with the association date as filed.
 * Association dates describe the reported relationship -- not a confirmed purchase date.
 */
function DisclosureTable({ records }: { records: OwnershipRecord[] }) {
  const sorted = useMemo(
    () =>
      [...records].sort((a, b) => {
        const directDelta = Number(isDirectOwner(b.role)) - Number(isDirectOwner(a.role))
        if (directDelta !== 0) return directDelta
        const pa = parseFloat(a.percentage)
        const pb = parseFloat(b.percentage)
        if (Number.isNaN(pa) && Number.isNaN(pb)) return 0
        if (Number.isNaN(pa)) return 1
        if (Number.isNaN(pb)) return -1
        return pb - pa
      }),
    [records]
  )

  const directCount = sorted.filter((r) => isDirectOwner(r.role)).length
  const otherCount = sorted.length - directCount

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-2 text-sm font-semibold">Ownership disclosure ({records.length} {records.length === 1 ? 'role' : 'roles'})</h3>
      {/* Phone width gets a stacked list -- four squeezed columns clipped the association dates.
          From sm up, the table fits fine. */}
      <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 sm:hidden">
        {sorted.map((r, i) => (
          <li key={i} className="py-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 text-sm text-slate-700 dark:text-slate-200">{r.ownerName}</span>
              <span className="shrink-0 text-sm tabular-nums">{/^\d/.test(r.percentage) ? r.percentage : '—'}</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {shortRole(r.role)}
              {r.associationDate && ` · associated since ${bareAssociationDate(r.associationDate)}`}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[26rem] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="py-1 pr-2 font-medium">Name (as disclosed)</th>
              <th className="py-1 pr-2 font-medium">%</th>
              <th className="py-1 pr-2 font-medium">Role</th>
              <th className="py-1 font-medium">Associated since</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="py-1.5 pr-2 text-slate-700 dark:text-slate-200">{r.ownerName}</td>
                <td className="py-1.5 pr-2 tabular-nums">{/^\d/.test(r.percentage) ? r.percentage : '—'}</td>
                <td className="py-1.5 pr-2">{shortRole(r.role)}</td>
                <td className="py-1.5 tabular-nums text-slate-500 dark:text-slate-400">{r.associationDate ? bareAssociationDate(r.associationDate) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {records.length} disclosed ownership/control relationship{records.length === 1 ? '' : 's'}
        {directCount > 0 && `: ${directCount} direct owner${directCount === 1 ? '' : 's'} ("5% or greater direct ownership interest" shortened)`}
        {otherCount > 0 && ` plus ${otherCount} other role${otherCount === 1 ? '' : 's'} (no equity unless a % is shown)`}.
        Association dates describe the reported relationship — not a confirmed purchase date.
      </p>
    </div>
  )
}

interface ExactMatch {
  ccn: string
  roles: string[]
}

/**
 * Exact-name matches for this facility's disclosed direct owners across the national CMS
 * Ownership dataset. CMS publishes no unique owner identifier, so an identical name is a lead,
 * not confirmed portfolio membership -- the card says so wherever the counts appear.
 */
function PortfolioContextCard({ facility, records, snfByCcn }: { facility: FacilityRecord; records: OwnershipRecord[]; snfByCcn: Map<string, SnfRecord> }) {
  const directOwners = useMemo(() => [...new Set(records.filter((r) => isDirectOwner(r.role)).map((r) => r.ownerName).filter(Boolean))], [records])
  const [open, setOpen] = useState(false)
  const [matches, setMatches] = useState<Map<string, ExactMatch[]> | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || matches != null || directOwners.length === 0) return
    let cancelled = false
    Promise.all(
      directOwners.map(async (name) => {
        const hits = await searchOwnersByNameAll(name)
        const exact = normalizeOwnerName(name)
        const byFac = new Map<string, Set<string>>()
        for (const h of hits) {
          if (normalizeOwnerName(h.ownerName) !== exact || h.ccn === facility.ccn) continue
          if (!byFac.has(h.ccn)) byFac.set(h.ccn, new Set())
          if (h.role) byFac.get(h.ccn)!.add(formatRole(h.role))
        }
        return [name, [...byFac.entries()].map(([ccn, roles]) => ({ ccn, roles: [...roles] }))] as const
      })
    )
      .then((entries) => {
        if (!cancelled) setMatches(new Map(entries))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, matches, directOwners, facility.ccn])

  if (directOwners.length === 0) return null

  const PREVIEW = 6

  return (
    <details
      className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer select-none text-sm font-semibold">Portfolio context — unverified same-name matches</summary>
      <div className="mt-2 flex flex-col gap-3 text-sm">
        {error && <p className="text-xs text-slate-500 dark:text-slate-400">Same-name search unavailable — try again later.</p>}
        {!error && matches == null && <p className="text-xs text-slate-500 dark:text-slate-400">Searching the national ownership dataset…</p>}
        {matches != null &&
          directOwners.map((name) => {
            const list = matches.get(name) ?? []
            if (list.length === 0) return null
            const states = [...new Set(list.map((m) => snfByCcn.get(m.ccn)?.state).filter(Boolean))].sort()
            return (
              <div key={name}>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Exact-name match: {list.length} other {list.length === 1 ? 'facility lists' : 'facilities list'} an owner named “{name}”
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {list.slice(0, PREVIEW).map((m) => {
                    const f = snfByCcn.get(m.ccn)
                    return (
                      <li key={m.ccn} className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">{f ? titleCaseName(f.name) : `CCN ${m.ccn}`}</span>
                        <span className="shrink-0 text-slate-500 dark:text-slate-400">{f ? `${f.city}, ${f.state}` : ''}</span>
                      </li>
                    )
                  })}
                </ul>
                {list.length > PREVIEW && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    …and {list.length - PREVIEW} more{states.length > 0 ? ` across ${states.join(', ')}` : ''} — all current rows in the CMS
                    Ownership dataset with that exact owner name.
                  </p>
                )}
              </div>
            )
          })}
        {matches != null && [...matches.values()].every((l) => l.length === 0) && (
          <p className="text-xs text-slate-500 dark:text-slate-400">No other facility lists any of this facility's disclosed direct owners under the exact same name.</p>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          CMS publishes no unique owner identifier, so an identical name is a lead, not confirmed portfolio membership; no shared
          ownership is claimed until entities are matched.
        </p>
      </div>
    </details>
  )
}

/**
 * Recorded Medicare enrollment ownership transfers (CHOW) plus the most recent association date
 * on the current disclosure. A CHOW is a Medicare enrollment transfer — not by itself a
 * confirmed property sale. CMS publishes no sale prices or deed records.
 */
function OwnershipChangesCard({ facility, records }: { facility: FacilityRecord; records: OwnershipRecord[] }) {
  const [chow, setChow] = useState<ChowData | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    loadChowData().then((d) => {
      if (!cancelled) setChow(d)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const entries = chow?.entries[facility.ccn] ?? []
  const latestAssociation = useMemo(() => {
    const dated = records
      .map((r) => {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(bareAssociationDate(r.associationDate))
        return m ? { iso: `${m[3]}-${m[1]}-${m[2]}`, display: bareAssociationDate(r.associationDate), names: [r.ownerName] } : null
      })
      .filter((d): d is { iso: string; display: string; names: string[] } => d != null)
    if (dated.length === 0) return null
    const maxIso = dated.reduce((a, b) => (b.iso > a.iso ? b : a)).iso
    const holders = dated.filter((d) => d.iso === maxIso)
    return { display: holders[0].display, names: holders.map((h) => h.names[0]) }
  }, [records])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-2 text-sm font-semibold">Ownership changes</h3>
      <div className="flex flex-col gap-2 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Recorded Medicare change of ownership</div>
          {chow === undefined && <div className="text-xs text-slate-500 dark:text-slate-400">Loading…</div>}
          {chow === null && <div className="text-xs text-slate-500 dark:text-slate-400">CHOW reference file unavailable.</div>}
          {chow && entries.length === 0 && (
            <div className="text-slate-700 dark:text-slate-200">No entry for this facility in the {chow.releaseDate} CHOW file</div>
          )}
          {chow &&
            entries.map((e, i) => (
              <div key={i} className="text-slate-700 dark:text-slate-200">
                {e.effectiveDate} — {titleCaseName(e.buyerDba || e.buyerOrg)} from {titleCaseName(e.sellerDba || e.sellerOrg)}
              </div>
            ))}
        </div>
        {latestAssociation && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Most recent association date</div>
            <div className="text-slate-700 dark:text-slate-200">
              {latestAssociation.display} ({latestAssociation.names.length > 2 ? `${latestAssociation.names.length} entries on the current disclosure` : latestAssociation.names.join(', ')})
            </div>
          </div>
        )}
        {chow && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The CHOW file lists {chow.transferCount.toLocaleString()} recorded Medicare enrollment ownership transfers with effective dates{' '}
            {chow.coverageStart} to {chow.coverageEnd}; CMS notes it covers most, not all, transfers in that window. A CHOW is a Medicare
            enrollment transfer — not by itself a confirmed property sale. CMS publishes no sale prices or deed records; confirmed
            property-sale history requires county recorder records or paid deal databases.
          </p>
        )}
      </div>
    </div>
  )
}

/** The Ownership detail tab: disclosure table, same-name portfolio context, and CHOW context. */
export function OwnershipTab({ facility, snfs }: { facility: FacilityRecord; snfs: SnfRecord[] }) {
  const { records, loading, error } = useOwnership(facility.ccn, facility.kind === 'snf')
  const snfByCcn = useMemo(() => new Map(snfs.map((f) => [f.ccn, f])), [snfs])

  if (facility.kind !== 'snf') {
    return (
      <p className="text-sm text-[--color-text-secondary]">
        CMS publishes owner and managing-party disclosures for skilled nursing facilities only. Unavailable in this
        dataset for hospitals.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {loading && <p className="text-sm text-[--color-text-secondary]">Loading ownership disclosure…</p>}
      {error && <p className="text-sm text-[--color-text-secondary]">Ownership data unavailable — try again later.</p>}
      {records && records.length === 0 && <p className="text-sm text-[--color-text-secondary]">No ownership disclosure on file for this facility.</p>}
      {records && records.length > 0 && (
        <>
          <DisclosureTable records={records} />
          <PortfolioContextCard facility={facility} records={records} snfByCcn={snfByCcn} />
          <OwnershipChangesCard facility={facility} records={records} />
        </>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Sources: CMS Ownership disclosures (queried live) · CMS PECOS SNF change-of-ownership file (release date cited above).
      </p>
    </div>
  )
              }
