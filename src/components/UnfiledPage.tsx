import { useState } from 'react'
import type { SavedFacilityRow } from '../data/db'
import type { FacilityRecord, HospitalRecord, SnfRecord, Portfolio } from '../types/facility'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { getBedsDisplay, getOccupancyDisplay, getCmsAsOf, formatDate, titleCaseName } from '../lib/facilityDisplay'
import { BookmarkIcon } from './BookmarkIcon'
import { BoardViews, type BoardView, type ResolvedSaved } from './BoardViews'

/**
 * Saved facilities that are in no portfolio.
 *
 * This is where the old ScoutBoard overview's working surface now lives: per-facility notes,
 * manual reordering, removal, and assigning a facility into a portfolio. Those are the only places
 * in the app that do any of those things, so they moved here with the page rather than going away
 * when the overview did -- see docs/preservation.md.
 */
export function UnfiledPage({
  unfiled,
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
  onToggleMember
}: {
  unfiled: SavedFacilityRow[]
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
  onToggleMember: (portfolioId: string, facilityId: string, inPortfolio: boolean) => void
}) {
  const [assignOpenFor, setAssignOpenFor] = useState<string | null>(null)

  function resolve(row: SavedFacilityRow): FacilityRecord | undefined {
    return row.kind === 'snf' ? snfs.find((s) => s.ccn === row.ccn) : hospitals.find((h) => h.ccn === row.ccn)
  }

  const [boardView, setBoardView] = useState<BoardView>('cards')

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-44 lg:max-w-6xl lg:pb-32">
      <h1 className="text-xl font-bold">Unfiled</h1>

      {unfiled.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[--color-border-strong] p-8 text-center">
          <BookmarkIcon filled={false} className="mx-auto mb-2 text-2xl text-[--color-text-muted]" />
          <p className="text-sm text-[--color-text-secondary]">Nothing unfiled.</p>
          <p className="mt-1 text-sm text-[--color-text-muted]">
            Every saved facility is in a portfolio. Open one from the navigation to see it.
          </p>
        </div>
      ) : (
        <>
          <BoardViews
            items={unfiled.map<ResolvedSaved>((row) => ({ row, facility: resolve(row) }))}
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
              {unfiled.map((row, i) => {
                const facility = resolve(row)
                const occ = facility ? getOccupancyDisplay(facility) : null
                const cmsAsOf = facility ? getCmsAsOf(facility) : null
                return (
                  <div key={row.id} className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button className="min-w-0 flex-1 text-left" onClick={() => facility && onOpen(facility, row.radiusMiles)}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{titleCaseName(row.name)}</span>
                          {facility && <TypeBadge facility={facility} />}
                        </div>
                        <div className="text-xs text-[--color-text-muted]">
                          {row.city}, {row.state}
                        </div>
                      </button>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex gap-1">
                          <button onClick={() => onMove(row, -1)} disabled={i === 0} title="Move up" className="text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-30">▲</button>
                          <button onClick={() => onMove(row, 1)} disabled={i === unfiled.length - 1} title="Move down" className="text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-30">▼</button>
                          <button onClick={() => onRemove(row)} title="Remove from ScoutBoard" className="text-[--color-text-muted] hover:text-[--color-negative]">✕</button>
                        </div>
                      </div>
                    </div>

                    {facility && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[--color-text-secondary]">
                        <span>{getBedsDisplay(facility)} beds</span>
                        <span>{occ?.text} occupancy</span>
                        <StarRating rating={facility.overallRating} />
                      </div>
                    )}

                    {/* Two different dates that were previously conflated into one "metrics as of
                        <save date>" line: when CMS last published the figures, and when this facility
                        was put on the board. Beds, occupancy and ratings all come from the same Care
                        Compare snapshot, so there is one source date covering them, not one each. */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[--color-text-muted]">
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
                      className="mt-2 w-full resize-none rounded-lg border border-[--color-border] bg-[--color-surface-sunken] px-2 py-1 text-sm text-[--color-text]"
                    />

                    {portfolios.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => setAssignOpenFor(assignOpenFor === row.id ? null : row.id)}
                          className="text-xs font-medium text-[--color-brand-strong] hover:underline"
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
                                  aria-pressed={active}
                                  className={`rounded-[--radius-pill] border px-2.5 py-1 text-xs ${
                                    active
                                      ? 'border-[--color-brand] bg-[--color-brand-subtle] text-[--color-brand-strong]'
                                      : 'border-[--color-border-strong] text-[--color-text-secondary]'
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
