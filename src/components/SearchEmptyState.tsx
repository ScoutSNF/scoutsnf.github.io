import type { RecentFacility } from '../lib/recentFacilities'
import { titleCaseName } from '../lib/facilityDisplay'

/**
 * Shown on Search before anything is selected. Previously this area was simply blank, which gave
 * a first-time visitor no idea what the app does or where to start. An empty state explaining an
 * otherwise-blank screen is the one place prose is warranted (see CLAUDE.md).
 */
export function SearchEmptyState({
  onTryExample,
  recents = [],
  onOpenRecent,
  onClearRecents
}: {
  onTryExample?: () => void
  recents?: RecentFacility[]
  onOpenRecent?: (r: RecentFacility) => void
  onClearRecents?: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {recents.length > 0 && (
        <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-surface] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[--color-text]">Recently viewed</h2>
            {onClearRecents && (
              <button
                onClick={onClearRecents}
                className="min-h-[1.75rem] text-xs font-medium text-[--color-text-secondary] underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <ul className="flex flex-col divide-y divide-[--color-border]">
            {recents.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => onOpenRecent?.(r)}
                  className="flex w-full min-h-[2.75rem] flex-col items-start py-2 text-left hover:bg-[--color-surface-hover]"
                >
                  <span className="text-sm font-medium text-[--color-text]">{titleCaseName(r.name)}</span>
                  <span className="text-xs text-[--color-text-secondary]">
                    {r.city}, {r.state} · CCN {r.ccn} · {r.kind === 'snf' ? 'SNF' : 'Hospital'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

    <div className="rounded-[--radius-lg] border border-dashed border-[--color-border-strong] bg-[--color-surface] p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Scout a facility's local market</h2>
      <p className="mt-1.5 text-sm leading-snug text-slate-600 dark:text-slate-300">
        Search any US skilled nursing facility to see its CMS ratings, occupancy and cost-report financials — plus every
        competing SNF and hospital within a radius you choose.
      </p>

      <ol className="mt-4 flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
        {[
          ['Search', 'by facility name, city, or ZIP'],
          ['Review the local market', 'competitors and hospitals within 10–40 miles'],
          ['Save', 'the ones worth tracking to your ScoutBoard'],
          ['Compare', 'saved facilities, or group them into a portfolio']
        ].map(([step, detail], i) => (
          <li key={step} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              {i + 1}
            </span>
            <span>
              <span className="font-semibold">{step}</span>{' '}
              <span className="text-slate-600 dark:text-slate-300">— {detail}</span>
            </span>
          </li>
        ))}
      </ol>

      {onTryExample && (
        <button
          onClick={onTryExample}
          className="mt-4 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Try an example facility
        </button>
      )}
    </div>
    </div>
  )
}
