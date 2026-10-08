import { useEffect, useState } from 'react'
import { SNF_ROSTER_ERROR_KEY, HOSPITAL_ROSTER_ERROR_KEY, type RosterManifest } from '../data/dataset'
import { formatDate } from '../lib/facilityDisplay'
import { applyThemePreference, readThemePreference, type ThemePreference } from '../lib/theme'

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[--radius-lg] border border-[--color-border] bg-[--color-surface] p-4">
      <h2 className="text-sm font-semibold text-[--color-text]">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-[--color-text-secondary]">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Row({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'bad' }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-[--color-border] py-2 last:border-0">
      <dt className="text-sm text-[--color-text-secondary]">{label}</dt>
      <dd className={`text-sm tabular-nums ${tone === 'bad' ? 'text-[--color-negative]' : 'text-[--color-text]'}`}>{value}</dd>
    </div>
  )
}

/**
 * Settings as a page rather than a dropdown.
 *
 * Separates three things that were previously stacked in one narrow menu: what the data is and
 * when it was published, actions that change it, and where definitions live. Dates are reported
 * for what they actually are -- the pipeline's publication date and this browser's last fetch are
 * different facts and are labelled separately, because a refresh that fails must not look like
 * fresh data.
 */
export function SettingsPage({
  snfFetchedAt,
  hospitalFetchedAt,
  rosterManifest,
  refreshing,
  onRefresh,
  onRecheckCoordinates,
  onOpenLegend
}: {
  snfFetchedAt: string
  hospitalFetchedAt: string
  rosterManifest: RosterManifest | null
  refreshing: boolean
  onRefresh: () => void
  onRecheckCoordinates: () => Promise<{ collisionCount: number; checkedAgainstLatest: boolean }>
  onOpenLegend: () => void
}) {
  const [snfError, setSnfError] = useState<string | null>(null)
  const [hospitalError, setHospitalError] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference())
  const [recheck, setRecheck] = useState<'idle' | 'running' | 'done'>('idle')
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const standalone =
    typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true
  const [recheckResult, setRecheckResult] = useState<{ collisionCount: number; checkedAgainstLatest: boolean } | null>(null)

  useEffect(() => {
    setSnfError(localStorage.getItem(SNF_ROSTER_ERROR_KEY))
    setHospitalError(localStorage.getItem(HOSPITAL_ROSTER_ERROR_KEY))
  }, [refreshing])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const bedCounts = rosterManifest?.hospital.bedCounts ?? null

  async function runRecheck() {
    setRecheck('running')
    setRecheckResult(await onRecheckCoordinates())
    setRecheck('done')
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24 lg:max-w-4xl">
      <Section title="Appearance" description="Applies to this browser only.">
        <fieldset>
          <legend className="sr-only">Theme</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
            {(['light', 'dark', 'system'] as ThemePreference[]).map((option) => {
              const active = theme === option
              return (
                <button
                  key={option}
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setTheme(option)
                    applyThemePreference(option)
                  }}
                  className={`min-h-[2.75rem] rounded-[--radius-md] border px-4 py-2 text-sm font-medium capitalize ${
                    active
                      ? 'border-[--color-brand] bg-[--color-brand-subtle] text-[--color-brand-strong]'
                      : 'border-[--color-border-strong] text-[--color-text] hover:bg-[--color-surface-hover]'
                  }`}
                >
                  {option === 'system' ? 'Match system' : option}
                </button>
              )
            })}
          </div>
        </fieldset>
      </Section>

      <Section
        title="Data status"
        description="When this data was published by the automated pipeline, and when this browser last fetched it."
      >
        <dl>
          {rosterManifest ? (
            <Row label="Roster published" value={formatDate(rosterManifest.built_at)} />
          ) : (
            <Row label="Roster published" value="Unavailable in this dataset" />
          )}
          <Row label="SNF roster fetched by this browser" value={snfFetchedAt ? formatDate(snfFetchedAt) : 'Not yet fetched'} />
          <Row
            label="Hospital roster fetched by this browser"
            value={hospitalFetchedAt ? formatDate(hospitalFetchedAt) : 'Not yet fetched'}
          />
          {rosterManifest && <Row label="SNFs in roster" value={rosterManifest.snf.count.toLocaleString()} />}
          {rosterManifest && <Row label="Hospitals in roster" value={rosterManifest.hospital.count.toLocaleString()} />}
          {bedCounts &&
            (bedCounts.error ? (
              <Row label="Hospital bed data" value={`Unavailable this build — ${bedCounts.error}`} tone="bad" />
            ) : (
              <Row label="Hospital bed data" value={`${bedCounts.matched} of ${bedCounts.total} matched`} />
            ))}
          {snfError && <Row label="Last SNF refresh" value={`Failed — ${snfError}`} tone="bad" />}
          {hospitalError && <Row label="Last hospital refresh" value={`Failed — ${hospitalError}`} tone="bad" />}
        </dl>
      </Section>

      <Section title="Data actions">
        <div className="flex flex-col gap-3">
          <div>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="min-h-[2.75rem] rounded-[--radius-md] border border-[--color-border-strong] px-3 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-surface-hover] disabled:opacity-60"
            >
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
            <p className="mt-1 text-sm text-[--color-text-secondary]">
              Fetches the latest roster already published by the pipeline. It cannot make the data newer than what has
              been published — if the pipeline has not run, this changes nothing.
            </p>
          </div>

          <div>
            <button
              onClick={runRecheck}
              disabled={recheck === 'running'}
              className="min-h-[2.75rem] rounded-[--radius-md] border border-[--color-border-strong] px-3 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-surface-hover] disabled:opacity-60"
            >
              {recheck === 'running' ? 'Checking…' : 'Re-check facility locations'}
            </button>
            <p className="mt-1 text-sm text-[--color-text-secondary]">
              {recheck === 'done' && recheckResult
                ? recheckResult.collisionCount === 0
                  ? `No duplicate coordinates found${recheckResult.checkedAgainstLatest ? ' in the latest published roster' : ' in cached data (latest roster unreachable)'}.`
                  : `${recheckResult.collisionCount} facilities still share a location with another${recheckResult.checkedAgainstLatest ? '' : ' (checked against cached data)'}. These are corrected by the pipeline, not from here.`
                : 'Reports facilities whose CMS coordinates collide with another facility. No lookups happen in your browser.'}
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Offline and cached data"
        description="What this browser can still show without a connection, and what it cannot."
      >
        <dl>
          <Row label="Connection" value={online ? 'Online' : 'Offline'} tone={online ? 'normal' : 'bad'} />
          <Row label="App installed as a PWA" value={standalone ? 'Yes' : 'No'} />
          <Row
            label="Facility data cached in this browser"
            value={snfFetchedAt ? `Yes — last fetched ${formatDate(snfFetchedAt)}` : 'Not yet cached'}
          />
        </dl>
        <p className="mt-2 text-sm text-[--color-text-secondary]">
          Offline means the facility data this browser has already downloaded, carrying the dates shown above — not
          live CMS data. Map tiles are <strong>not</strong> cached, because OpenStreetMap's usage policy forbids
          pre-caching them, so the map will be blank offline. Owner and manager lookups query CMS live and need a
          connection.
        </p>
      </Section>

      <Section title="Definitions and sources">
        <button
          onClick={onOpenLegend}
          className="min-h-[2.75rem] rounded-[--radius-md] border border-[--color-border-strong] px-3 py-2 text-sm font-medium text-[--color-text] hover:bg-[--color-surface-hover]"
        >
          Open sources &amp; definitions
        </button>
        <p className="mt-1 text-sm text-[--color-text-secondary]">
          Every metric with its source, refresh cadence, formula and limitations.
        </p>
      </Section>
    </div>
  )
}
