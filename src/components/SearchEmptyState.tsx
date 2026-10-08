/**
 * Shown on Search before anything is selected. Previously this area was simply blank, which gave
 * a first-time visitor no idea what the app does or where to start. An empty state explaining an
 * otherwise-blank screen is the one place prose is warranted (see CLAUDE.md).
 */
export function SearchEmptyState({ onTryExample }: { onTryExample?: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 dark:border-slate-700 dark:bg-slate-900/40">
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
  )
}
