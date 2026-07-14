import { useEffect, useRef, useState } from 'react'
import { BEDS_ERROR_KEY, SNF_ROSTER_ERROR_KEY, HOSPITAL_ROSTER_ERROR_KEY } from '../data/dataset'

export function SettingsMenu({
  snfFetchedAt,
  hospitalFetchedAt,
  onRefresh,
  onRecheckCoordinates,
  onOpenLegend
}: {
  snfFetchedAt: string
  hospitalFetchedAt: string
  onRefresh: () => void
  onRecheckCoordinates: (onProgress?: (done: number, total: number) => void) => Promise<number>
  onOpenLegend: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const [recheckStatus, setRecheckStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [recheckProgress, setRecheckProgress] = useState<{ done: number; total: number } | null>(null)
  const [recheckCount, setRecheckCount] = useState<number | null>(null)
  const [bedsError, setBedsError] = useState<string | null>(null)
  const [snfRosterError, setSnfRosterError] = useState<string | null>(null)
  const [hospitalRosterError, setHospitalRosterError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setBedsError(localStorage.getItem(BEDS_ERROR_KEY))
    setSnfRosterError(localStorage.getItem(SNF_ROSTER_ERROR_KEY))
    setHospitalRosterError(localStorage.getItem(HOSPITAL_ROSTER_ERROR_KEY))
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

  async function handleRecheckClick() {
    setRecheckStatus('running')
    setRecheckProgress(null)
    const count = await onRecheckCoordinates((done, total) => setRecheckProgress({ done, total }))
    setRecheckCount(count)
    setRecheckStatus('done')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        title="Settings"
        className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Data</p>
          <div className="mb-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <div>SNF roster: {snfFetchedAt ? new Date(snfFetchedAt).toLocaleString() : 'unknown'}</div>
            {snfRosterError && (
              <div className="text-red-600 dark:text-red-400">SNF roster refresh failed: {snfRosterError}</div>
            )}
            <div>Hospital roster: {hospitalFetchedAt ? new Date(hospitalFetchedAt).toLocaleString() : 'unknown'}</div>
            {hospitalRosterError && (
              <div className="text-red-600 dark:text-red-400">Hospital roster refresh failed: {hospitalRosterError}</div>
            )}
            {bedsError && (
              <div className="text-red-600 dark:text-red-400">Hospital bed data: {bedsError}</div>
            )}
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

          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              onClick={handleRecheckClick}
              disabled={recheckStatus === 'running'}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-left text-xs hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {recheckStatus === 'running' ? 'Checking…' : 'Re-check facility locations'}
            </button>
            <p className="mt-1.5 text-[10px] text-slate-400">
              {recheckStatus === 'running' && recheckProgress
                ? `Verifying ${recheckProgress.done}/${recheckProgress.total} facilities that share a location with another…`
                : recheckStatus === 'done'
                  ? recheckCount === 0
                    ? 'No duplicate locations found.'
                    : `Re-verified ${recheckCount} facilit${recheckCount === 1 ? 'y' : 'ies'} that shared a location with another.`
                  : 'Fast, targeted fix for a known CMS data quirk (some facilities share a location with another). Only re-checks the ones affected — no full refresh needed.'}
            </p>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              onClick={() => {
                onOpenLegend()
                setOpen(false)
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Legend — data sources
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
