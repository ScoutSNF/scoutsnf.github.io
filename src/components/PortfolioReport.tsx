import type { PortfolioReportData } from '../lib/portfolioReport'
import type { Portfolio } from '../types/facility'
import { StarRating } from './StarRating'
import { getBedsDisplay, getOccupancyDisplay } from '../lib/facilityDisplay'
import { rowsToCsv, downloadCsv } from '../lib/exportCsv'

export function PortfolioReport({
  portfolio,
  data,
  onClose
}: {
  portfolio: Portfolio
  data: PortfolioReportData
  onClose: () => void
}) {
  function exportReport() {
    const distanceRows = data.distances.map((d) => ({
      'Facility A': d.a.row.name,
      'Facility B': d.b.row.name,
      'Distance (mi)': d.distanceMiles
    }))
    const sharedRows = data.sharedCompetitors.map((c) => ({
      Competitor: c.facility.name,
      City: c.facility.city,
      State: c.facility.state,
      'Near your facilities': c.near.map((n) => `${n.member.row.name} (${n.distanceMiles} mi)`).join(' | ')
    }))
    const csv = [
      `Portfolio: ${portfolio.name}`,
      '',
      'Distances between your facilities',
      rowsToCsv(['Facility A', 'Facility B', 'Distance (mi)'], distanceRows),
      '',
      'Competitors near 2+ of your facilities',
      rowsToCsv(['Competitor', 'City', 'State', 'Near your facilities'], sharedRows)
    ].join('\n')
    downloadCsv(`${portfolio.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.csv`, csv)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <div>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            ← Back to ScoutBoard
          </button>
          <h1 className="mt-1 text-xl font-bold">{portfolio.name}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {data.members.length} facilit{data.members.length === 1 ? 'y' : 'ies'}
            {data.statesCovered.length > 0 ? ` · ${data.statesCovered.join(', ')}` : ''}
          </p>
        </div>
        <button
          onClick={exportReport}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Export CSV
        </button>
      </div>

      {data.members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No facilities in this portfolio yet. Add some from ScoutBoard.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-2 text-sm font-semibold">Facilities in this portfolio</h2>
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {data.members.map((m) => {
                const occ = getOccupancyDisplay(m.facility)
                return (
                  <div key={m.row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <span className="font-medium">{m.row.name}</span>{' '}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {m.row.city}, {m.row.state}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <span>{getBedsDisplay(m.facility)} beds</span>
                      <span>{occ.text} occ</span>
                      <StarRating rating={m.facility.overallRating} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {data.members.length >= 2 && (
            <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 text-sm font-semibold">Distance between your facilities</h2>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {data.distances.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {d.a.row.name} ↔ {d.b.row.name}
                    </span>
                    <span className="font-medium">{d.distanceMiles} mi</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">Competitors between your facilities</h2>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              SNFs within the saved search radius of two or more of your facilities — the shared competitive ground between
              them. {data.uniqueCompetitorCount} unique competitor{data.uniqueCompetitorCount === 1 ? '' : 's'} total across
              the portfolio.
            </p>
            {data.sharedCompetitors.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No competitors currently fall within range of more than one of your facilities.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {data.sharedCompetitors.map((c) => (
                  <div key={c.facility.ccn} className="py-2 text-sm">
                    <div className="font-medium">
                      {c.facility.name}{' '}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {c.facility.city}, {c.facility.state}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {c.near.map((n, i) => (
                        <span key={i}>
                          {n.distanceMiles} mi from {n.member.row.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
