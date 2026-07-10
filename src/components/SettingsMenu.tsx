import { useEffect, useRef, useState } from 'react'

export function SettingsMenu({
  snfFetchedAt,
  hospitalFetchedAt,
  onRefresh
}: {
  snfFetchedAt: string
  hospitalFetchedAt: string
  onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function handleRefreshClick() {
    const confirmed = window.confirm(
      'Refresh all data from CMS/Census? This re-fetches the full national roster and can take several minutes (hospital geocoding especially). Only do this if the data actually needs updating.'
    )
    if (confirmed) {
      onRefresh()
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        title="Settings"
        className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M16.2 10a6.2 6.2 0 0 0-.08-1l1.6-1.25-1.4-2.42-1.9.63a6.3 6.3 0 0 0-1.73-1L12.4 2.6H9.6l-.3 1.96a6.3 6.3 0 0 0-1.73 1l-1.9-.63L4.28 7.36l1.6 1.25a6.2 6.2 0 0 0 0 2l-1.6 1.25 1.4 2.42 1.9-.63a6.3 6.3 0 0 0 1.73 1l.3 1.96h2.8l.3-1.96a6.3 6.3 0 0 0 1.73-1l1.9.63 1.4-2.42-1.6-1.25c.05-.33.08-.66.08-1Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Data</p>
          <div className="mb-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <div>SNF roster: {snfFetchedAt ? new Date(snfFetchedAt).toLocaleString() : 'unknown'}</div>
            <div>Hospital roster: {hospitalFetchedAt ? new Date(hospitalFetchedAt).toLocaleString() : 'unknown'}</div>
          </div>
          <button
            onClick={handleRefreshClick}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Refresh data…
          </button>
          <p className="mt-1.5 text-[10px] text-slate-400">
            Re-fetches everything from CMS/Census. Can take several minutes.
          </p>
        </div>
      )}
    </div>
  )
}
