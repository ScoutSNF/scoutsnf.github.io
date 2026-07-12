import { useEffect, useState } from 'react'
import { getLegendEntry, type LegendKey } from '../lib/legend'

export function InfoPopover({ legendKey, className }: { legendKey: LegendKey; className?: string }) {
  const [open, setOpen] = useState(false)
  const entry = getLegendEntry(legendKey)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!entry) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`Source & details for ${entry.stat}`}
        title="Source & details"
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[9px] font-semibold leading-none text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:border-slate-600 dark:text-slate-500 dark:hover:text-slate-300 ${className ?? ''}`}
      >
        i
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">{entry.stat}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <dl className="mt-2.5 space-y-2 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Source</dt>
                <dd className="text-slate-700 dark:text-slate-300">{entry.source}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Refresh</dt>
                <dd className="text-slate-700 dark:text-slate-300">{entry.refresh}</dd>
              </div>
              {entry.details && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Details</dt>
                  <dd className="text-slate-700 dark:text-slate-300">{entry.details}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </>
  )
}
