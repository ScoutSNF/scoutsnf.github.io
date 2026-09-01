import { useEffect, useRef, useState } from 'react'
import { SNF_ROSTER_ERROR_KEY, HOSPITAL_ROSTER_ERROR_KEY, type RosterManifest } from '../data/dataset'

export function SettingsMenu({
  snfFetchedAt,
  hospitalFetchedAt,
  rosterManifest,
  onRefresh,
  onRecheckCoordinates,
  onOpenLegend
}: {
  snfFetchedAt: string
  hospitalFetchedAt: string
  rosterManifest: RosterManifest | null
  onRefresh: () => void
  onRecheckCoordinates: () => Promise<{ collisionCount: number; checkedAgainstLatest: boolean }>
  onOpenLegend: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const [snfRosterError, setSnfRosterError] = useState<string | null>(null)
  const [hospitalRosterError, setHospitalRosterError] = useState<string | null>(null)
  const [recheckStatus, setRecheckStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [recheckResult, setRecheckResult] = useState<{ collisionCount: number; checkedAgainstLatest: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
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
      'Pull the latest roster published by the automated data pipeline? This is fast — no live CMS/Census lookups happen in your browser.'
    )
    if (confirmed) {
      onRefresh()
      setOpen(false)
    }
  }

  async function handleRecheckClick() {
    setRecheckStatus('running')
    const result = await onRecheckCoordinates()
    setRecheckResult(result)
    setRecheckStatus('done')
  }

  // Roster/coordinates/bed counts are all resolved once, ahead of time, by the roster-pipeline.yml
  // CI job -- its build date is a more meaningful freshness signal than "when this browser last
  // fetched the file," so prefer it when the pipeline has run at least once.
  const snfDateLabel = rosterManifest
    ? new Date(rosterManifest.built_at).toLocaleString()
    : snfFetchedAt
      ? new Date(snfFetchedAt).toLocaleString()
      : 'unknown'
  const hospitalDateLabel = rosterManifest
    ? new Date(rosterManifest.built_at).toLocaleString()
    : hospitalFetchedAt
      ? new Date(hospitalFetchedAt).toLocaleString()
      : 'unknown'

  // Bed-data status is a distinct source from the roster/geocoding pipeline above (the CI job
  // isolates a bed-count-fetch failure rather than blocking the whole roster) -- kept as its own
  // line rather than folded into the generic roster-fetch error above.
  const bedCounts = rosterManifest?.hospital.bedCounts ?? null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        title="Settings"
        className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400"
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
            <div>SNF roster: {snfDateLabel}</div>
            {snfRosterError && (
              <div className="text-red-600 dark:text-red-400">SNF roster refresh failed: {snfRosterError}</div>
            )}
            <div>Hospital roster: {hospitalDateLabel}</div>
            {hospitalRosterError && (
              <div className="text-red-600 dark:text-red-400">Hospital roster refresh failed: {hospitalRosterError}</div>
            )}
            {bedCounts &&
              (bedCounts.error ? (
                <div className="text-red-600 dark:text-red-400">Hospital bed data: unavailable this build — {bedCounts.error}</div>
              ) : (
                <div>
                  Hospital bed data: {bedCounts.matched}/{bedCounts.total} matched
                </div>
              ))}
          </div>
          <button
            onClick={handleRefreshClick}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Refresh data…
          </button>
          <p className="mt-1.5 text-[10px] text-slate-400">
            Pulls the latest roster published by the automated data pipeline (runs weekly). Fast —
            no live CMS/Census lookups happen in your browser.
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
              {recheckStatus === 'done' && recheckResult
                ? recheckResult.collisionCount === 0
                  ? `No duplicate locations found${recheckResult.checkedAgainstLatest ? ' in the latest published roster' : ' in cached data (latest roster unreachable)'}.`
                  : `${recheckResult.collisionCount} facilit${recheckResult.collisionCount === 1 ? 'y' : 'ies'} currently share${recheckResult.collisionCount === 1 ? 's' : ''} a location with another${recheckResult.checkedAgainstLatest ? '' : ' (checked against cached data — latest roster unreachable)'}. These are corrected automatically by the data pipeline; check back after its next run.`
                : 'Checks the latest published roster (corrected automatically by the data pipeline) for facilities that still share a location. No lookups happen in your browser.'}
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
