import { LEGEND_GROUPS, getLegendEntry } from '../lib/legend'

export function LegendPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          ← Back
        </button>
        <h1 className="text-xl font-bold">Legend</h1>
      </div>

      <div className="flex flex-col gap-4">
        {LEGEND_GROUPS.map((group) => (
          <section key={group.title} className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <h2 className="border-b border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-800">{group.title}</h2>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {group.keys.map((key) => {
                const entry = getLegendEntry(key)
                if (!entry) return null
                return (
                  <div key={key} className="px-3 py-2.5">
                    <div className="text-sm font-medium">{entry.stat}</div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span>{entry.source}</span>
                      <span>{entry.refresh}</span>
                    </div>
                    {entry.details && (
                      <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{entry.details}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
