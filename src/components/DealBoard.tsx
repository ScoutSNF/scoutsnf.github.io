import type { SavedFacilityRow } from '../data/db'
import type { FacilityRecord, HospitalRecord, SnfRecord } from '../types/facility'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { getBedsDisplay, getOccupancyDisplay } from '../lib/facilityDisplay'
import { rowsToCsv, downloadCsv } from '../lib/exportCsv'

export function DealBoard({
  saved,
  snfs,
  hospitals,
  snfFetchedAt,
  hospitalFetchedAt,
  onOpen,
  onRemove,
  onNotesChange,
  onMove,
  onGoToSearch
}: {
  saved: SavedFacilityRow[]
  snfs: SnfRecord[]
  hospitals: HospitalRecord[]
  snfFetchedAt: string
  hospitalFetchedAt: string
  onOpen: (facility: FacilityRecord, radiusMiles: number) => void
  onRemove: (row: SavedFacilityRow) => void
  onNotesChange: (row: SavedFacilityRow, notes: string) => void
  onMove: (row: SavedFacilityRow, direction: -1 | 1) => void
  onGoToSearch: () => void
}) {
  function resolve(row: SavedFacilityRow): FacilityRecord | undefined {
    return row.kind === 'snf' ? snfs.find((s) => s.ccn === row.ccn) : hospitals.find((h) => h.ccn === row.ccn)
  }

  function exportBoard() {
    const rows = saved.map((row) => {
      const facility = resolve(row)
      const occ = facility ? getOccupancyDisplay(facility) : null
      return {
        Name: row.name,
        City: row.city,
        State: row.state,
        Type: row.kind === 'snf' ? 'SNF' : facility && facility.kind === 'hospital' ? facility.hospitalType : 'Hospital',
        'Saved Radius (mi)': row.radiusMiles,
        Beds: facility ? getBedsDisplay(facility) : 'N/A',
        Occupancy: occ?.text ?? 'N/A',
        Rating: facility?.overallRating ?? '',
        Notes: row.notes,
        'Saved At': row.savedAt
      }
    })
    const headers = ['Name', 'City', 'State', 'Type', 'Saved Radius (mi)', 'Beds', 'Occupancy', 'Rating', 'Notes', 'Saved At']
    downloadCsv('deal-board.csv', rowsToCsv(headers, rows))
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Deal Board</h1>
        <div className="flex gap-2">
          <button
            onClick={exportBoard}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Export CSV
          </button>
          <button onClick={onGoToSearch} className="rounded-lg bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90">
            + New search
          </button>
        </div>
      </div>

      {saved.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No saved deals yet. Search for a facility and tap the star to save it here.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {saved.map((row, i) => {
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
                      <button onClick={() => onMove(row, 1)} disabled={i === saved.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200">▼</button>
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
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
