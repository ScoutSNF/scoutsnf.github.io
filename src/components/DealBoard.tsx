import { useState } from 'react'
import type { SavedFacilityRow } from '../data/db'
import type { FacilityRecord, HospitalRecord, SnfRecord, Portfolio } from '../types/facility'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { getBedsDisplay, getOccupancyDisplay, getCmsAsOf, formatDate, titleCaseName } from '../lib/facilityDisplay'
import { BookmarkIcon } from './BookmarkIcon'
import { BoardViews, type BoardView, type ResolvedSaved } from './BoardViews'

export function DealBoard({
  saved,
  snfs,
  hospitals,
  portfolios,
  memberIdsByPortfolio,
  onOpen,
  onRemove,
  onNotesChange,
  onMove,
  compareIds,
  onToggleCompare,
  onCreatePortfolio,
  onDeletePortfolio,
  onToggleMember,
  onViewReport
}: {
  saved: SavedFacilityRow[]
  snfs: SnfRecord[]
  hospitals: HospitalRecord[]
  portfolios: Portfolio[]
  memberIdsByPortfolio: Map<string, Set<string>>
  onOpen: (facility: FacilityRecord, radiusMiles: number) => void
  onRemove: (row: SavedFacilityRow) => void
  onNotesChange: (row: SavedFacilityRow, notes: string) => void
  onMove: (row: SavedFacilityRow, direction: -1 | 1) => void
  compareIds: Set<string>
  onToggleCompare: (facility: FacilityRecord) => void
  onCreatePortfolio: (name: string) => void
  onDeletePortfolio: (id: string) => void
  onToggleMember: (portfolioId: string, facilityId: string, inPortfolio: boolean) => void
  onViewReport: (portfolioId: string) => void
}) {
  const [newPortfolioOpen, setNewPortfolioOpen] = useState(false)
  const [newPortfolioName, setNewPortfolioName] = useState('')
  const [assignOpenFor, setAssignOpenFor] = useState<string | null>(null)
  const [boardView, setBoardView] = useState<BoardView>('cards')

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-44 lg:max-w-6xl lg:pb-32">
      <h1 className="text-xl font-bold">ScoutBoard</h1>

      <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Portfolios</h2>
          <button
            onClick={() => setNewPortfolioOpen((v) => !v)}
            className="text-sm font-medium text-brand hover:underline dark:text-sky-300"
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
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
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
                    <button onClick={() => onViewReport(p.id)} className="text-sm font-medium text-brand hover:underline dark:text-sky-300">
                      View portfolio
                    </button>
                    <button
                      onClick={() => onDeletePortfolio(p.id)}
                      className="text-slate-500 dark:text-slate-400 hover:text-red-500"
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
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <BookmarkIcon filled={false} className="mx-auto mb-2 text-2xl text-slate-500 dark:text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-300">No saved facilities yet.</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Search for a facility and tap the bookmark to save it here.
          </p>
        </div>
      ) : unfiledSaved.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          All saved facilities are filed into a portfolio — open one above to view them, or remove a facility from its
          portfolio to bring it back here.
        </p>
      ) : (
        <>
        <BoardViews
          items={unfiledSaved.map<ResolvedSaved>((row) => ({ row, facility: resolve(row) }))}
          view={boardView}
          onViewChange={setBoardView}
          onOpen={onOpen}
          onRemove={onRemove}
          compareIds={compareIds}
          onToggleCompare={onToggleCompare}
        />

        <details className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-surface] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[--color-text]">
            Notes and portfolio assignment
          </summary>
        <div className="mt-3 flex flex-col gap-3">
          {unfiledSaved.map((row, i) => {
            const facility = resolve(row)
            const occ = facility ? getOccupancyDisplay(facility) : null
            const cmsAsOf = facility ? getCmsAsOf(facility) : null
            return (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => facility && onOpen(facility, row.radiusMiles)}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{titleCaseName(row.name)}</span>
                      {facility && <TypeBadge facility={facility} />}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {row.city}, {row.state}
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex gap-1">
                      <button onClick={() => onMove(row, -1)} disabled={i === 0} title="Move up" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200">▲</button>
                      <button onClick={() => onMove(row, 1)} disabled={i === unfiledSaved.length - 1} title="Move down" className="text-slate-500 dark:text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200">▼</button>
                      <button onClick={() => onRemove(row)} title="Remove from ScoutBoard" className="text-slate-500 dark:text-slate-400 hover:text-red-500">✕</button>
                    </div>
                  </div>
                </div>

                {facility && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                    <span>{getBedsDisplay(facility)} beds</span>
                    <span>{occ?.text} occupancy</span>
                    <StarRating rating={facility.overallRating} />
                  </div>
                )}

                {/* Two different dates that were previously conflated into one "metrics as of
                    <save date>" line: when CMS last published the figures, and when this facility
                    was put on the board. Beds, occupancy and ratings all come from the same Care
                    Compare snapshot, so there is one source date covering them, not one each. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {cmsAsOf ? (
                    <span>CMS data as of {formatDate(cmsAsOf)}</span>
                  ) : (
                    facility && <span>CMS data has no published "as of" date for hospitals</span>
                  )}
                  <span>Saved {formatDate(row.savedAt)}</span>
                </div>

                <textarea
                  value={row.notes}
                  onChange={(e) => onNotesChange(row, e.target.value)}
                  placeholder="Notes: broker, asking price, follow-ups…"
                  rows={2}
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
                />

                {portfolios.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setAssignOpenFor(assignOpenFor === row.id ? null : row.id)}
                      className="text-xs font-medium text-brand hover:underline dark:text-sky-300"
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
                                  ? 'border-brand bg-brand/10 text-brand dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-300'
                                  : 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'
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
        </details>
        </>
      )}
    </div>
  )
}
