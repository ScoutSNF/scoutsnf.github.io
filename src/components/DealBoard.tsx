import { useState } from 'react'
import type { SavedFacilityRow } from '../data/db'
import type { FacilityRecord, HospitalRecord, SnfRecord, Portfolio } from '../types/facility'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { getBedsDisplay, getOccupancyDisplay } from '../lib/facilityDisplay'

export function DealBoard({
  saved,
  snfs,
  hospitals,
  snfFetchedAt,
  hospitalFetchedAt,
  portfolios,
  memberIdsByPortfolio,
  onOpen,
  onRemove,
  onNotesChange,
  onMove,
  onGoToSearch,
  onCreatePortfolio,
  onDeletePortfolio,
  onToggleMember,
  onViewReport
}: {
  saved: SavedFacilityRow[]
  snfs: SnfRecord[]
  hospitals: HospitalRecord[]
  snfFetchedAt: string
  hospitalFetchedAt: string
  portfolios: Portfolio[]
  memberIdsByPortfolio: Map<string, Set<string>>
  onOpen: (facility: FacilityRecord, radiusMiles: number) => void
  onRemove: (row: SavedFacilityRow) => void
  onNotesChange: (row: SavedFacilityRow, notes: string) => void
  onMove: (row: SavedFacilityRow, direction: -1 | 1) => void
  onGoToSearch: () => void
  onCreatePortfolio: (name: string) => void
  onDeletePortfolio: (id: string) => void
  onToggleMember: (portfolioId: string, facilityId: string, inPortfolio: boolean) => void
  onViewReport: (portfolioId: string) => void
}) {
  const [newPortfolioOpen, setNewPortfolioOpen] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [assignOpenFor, setAssignOpenFor] = useState<string | null>(null)

  function resolve(row: SavedFacilityRow): FacilityRecord | undefined {
    return row.kind === 'snf' ? snfs.find((s) => s.ccn === row.ccn) : hospitals.find((h) => h.ccn === row.ccn)
  }

  function submitNewPortfolio() {
    const name = newPortfolioName.trim()
    if (!name) return
    onCreatePortfolio(name)
    setNewPortfolioName('')
    setNewPortfolioOpen(false)
  }

  const assignedFacilityIds = new Set<string>()
  for (const ids of memberIdsByPortfolio.values()) {
    for (const id of ids) assignedFacilityIds.add(id)
  }
  const unfiledSaved = saved.filter((row) => !assignedFacilityIds.has(row.id))

  const [exporting, setExporting] = useState(false)

  async function exportBoard() {
    setExporting(true)
    try {
      const { buildSimpleWorkbook, downloadBlob } = await import('../lib/simpleWorkbook')
      const rows = saved.map((row) => {
        const facility = resolve(row)
        const occ = facility ? getOccupancyDisplay(facility) : null
        return [
          row.name,
          row.city,
          row.state,
          row.kind === 'snf' ? 'SNF' : facility && facility.kind === 'hospital' ? facility.hospitalType : 'Hospital',
          row.radiusMiles,
          facility ? getBedsDisplay(facility) : 'N/A',
          occ?.text ?? 'N/A',
          facility?.overallRating != null ? facility.overallRating.toFixed(1) : '—',
          row.notes,
          new Date(row.savedAt).toLocaleDateString()
        ]
      })
      const blob = await buildSimpleWorkbook({
        title: 'ScoutBoard',
        subtitle: `Generated ${new Date().toLocaleString()} · ${saved.length} facilit${saved.length === 1 ? 'y' : 'ies'}`,
        sheetName: 'ScoutBoard',
        headers: ['Name', 'City', 'State', 'Type', 'Saved Radius (mi)', 'Beds', 'Occupancy', 'Rating', 'Notes', 'Saved At'],
        columnWidths: [34, 16, 7, 12, 12, 8, 12, 8, 40, 14],
        rows
      })
      downloadBlob('scoutboard.xlsx', blob)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">ScoutBoard</h1>
        <div className="flex gap-2">
          <button
            onClick={exportBoard}
            disabled={exporting}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {exporting ? 'Building…' : 'Download report (Excel)'}
          </button>
          <button onClick={onGoToSearch} className="rounded-lg bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90">
            + New search
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Portfolios</h2>
          <button
            onClick={() => setNewPortfolioOpen((v) => !v)}
            className="text-sm text-brand hover:underline"
          >
            + New portfolio
          </button>
        </div>

        {newPortfolioOpen && (
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              value={newPortfolioName}
              onChange={(e) => setNewPortfolioName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNewPortfolio()}
              placeholder="Portfolio name (e.g. Texas targets)"
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button onClick={submitNewPortfolio} className="rounded-lg bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90">
              Create
            </button>
          </div>
        )}

        {portfolios.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Group saved facilities into a portfolio to compare distances between them and see shared competition.
          </p>
        ) : (
          <div className="mt-2 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {portfolios.map((p) => {
              const count = memberIdsByPortfolio.get(p.id)?.size ?? 0
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <span className="font-medium">{p.name}</span>{' '}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {count} facilit{count === 1 ? 'y' : 'ies'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <button onClick={() => onViewReport(p.id)} className="text-sm text-brand hover:underline">
                      View portfolio
                    </button>
                    <button
                      onClick={() => onDeletePortfolio(p.id)}
                      className="text-slate-400 hover:text-red-500"
                      title="Delete portfolio"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {saved.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No saved deals yet. Search for a facility and tap the star to save it here.
        </p>
      ) : unfiledSaved.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          All saved facilities are filed into a portfolio — open one above to view them, or remove a facility from its
          portfolio to bring it back here.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {assignedFacilityIds.size > 0 && (
            <p className="text-xs text-slate-400">
              {assignedFacilityIds.size} saved facilit{assignedFacilityIds.size === 1 ? 'y is' : 'ies are'} filed into a
              portfolio and hidden here — view them from Portfolios above.
            </p>
          )}
          {unfiledSaved.map((row, i) => {
            const facility = resolve(row)
            const occ = facility ? getOccupancyDisplay(facility) : null
            const metricsAsOf = row.kind === 'snf' ? snfFetchedAt : hospitalFetchedAt
            return (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => facility && onOpen(facility, row.radiusMiles)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{row.name}</span>
                      {facility && <TypeBadge facility={facility} />}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {row.city}, {row.state} · saved radius {row.radiusMiles} mi
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex gap-1">
                      <button onClick={() => onMove(row, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200">▲</button>
                      <button onClick={() => onMove(row, 1)} disabled={i === unfiledSaved.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200">▼</button>
                      <button onClick={() => onRemove(row)} className="text-slate-400 hover:text-red-500">✕</button>
                    </div>
                  </div>
                </div>

                {facility && (
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <span>{getBedsDisplay(facility)} beds</span>
                    <span>{occ?.text} occupancy</span>
                    <StarRating rating={facility.overallRating} />
                    {metricsAsOf && (
                      <span className="text-slate-400">metrics as of {new Date(metricsAsOf).toLocaleDateString()}</span>
                    )}
                  </div>
                )}

                <textarea
                  value={row.notes}
                  onChange={(e) => onNotesChange(row, e.target.value)}
                  placeholder="Notes: deal stage, broker, asking price…"
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                />

                {portfolios.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setAssignOpenFor(assignOpenFor === row.id ? null : row.id)}
                      className="text-xs text-brand hover:underline"
                    >
                      Add to portfolio…
                    </button>
                    {assignOpenFor === row.id && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {portfolios.map((p) => {
                          const active = memberIdsByPortfolio.get(p.id)?.has(row.id) ?? false
                          return (
                            <button
                              key={p.id}
                              onClick={() => onToggleMember(p.id, row.id, !active)}
                              className={`rounded-full border px-2.5 py-1 text-xs ${
                                active
                                  ? 'border-brand bg-brand/10 text-brand'
                                  : 'border-slate-300 text-slate-400 dark:border-slate-700'
                              }`}
                            >
                              {p.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
