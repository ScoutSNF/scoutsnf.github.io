import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzLO2Z6YsfyOHu8333hnjrMDtJp9W_dUFdUEDtc5CJM9W1hm-agoKY6ATX72xE5XgZg/exec'
const GATE_VERSION = '1' // bump to force everyone to sign in again
const OFFLINE_GRACE_DAYS = 7

const IDENTITY_KEY = `scoutsnf.identity.v${GATE_VERSION}`
const LAST_CHECK_KEY = `scoutsnf.lastCheck.v${GATE_VERSION}`
const GATE_VERSION_KEY = 'scoutsnf.gateVersion'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

interface Identity {
  name: string
  email: string
  device: string
}

type Screen = 'loading' | 'form' | 'ok' | 'ended' | 'offline'

function makeDeviceId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `dev-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
  }
}

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Identity>
    if (typeof parsed.name === 'string' && typeof parsed.email === 'string' && typeof parsed.device === 'string') {
      return { name: parsed.name, email: parsed.email, device: parsed.device }
    }
    return null
  } catch {
    return null
  }
}

function saveIdentity(identity: Identity): void {
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity))
}

function clearIdentity(): void {
  localStorage.removeItem(IDENTITY_KEY)
  localStorage.removeItem(LAST_CHECK_KEY)
}

function getLastCheck(): number | null {
  const raw = localStorage.getItem(LAST_CHECK_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function setLastCheck(ts: number): void {
  localStorage.setItem(LAST_CHECK_KEY, String(ts))
}

/**
 * Plain GET, no custom headers, no body -- Apps Script triggers a CORS preflight
 * (which fails) if either is added. Returns true/false from the server's
 * `allowed` field, or null on any thrown error (network down, bad endpoint, etc).
 */
async function checkIn(identity: Identity, event: string): Promise<boolean | null> {
  try {
    const params = new URLSearchParams({
      name: identity.name,
      email: identity.email,
      device: identity.device,
      event,
      ua: navigator.userAgent.slice(0, 200)
    })
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, { redirect: 'follow' })
    const data = (await res.json()) as { allowed?: boolean }
    return data.allowed === false ? false : true
  } catch {
    return null
  }
}

/**
 * One-time flush for anyone running an already-installed, already-cached copy
 * of the app from before this gate existed. Keyed on GATE_VERSION so bumping
 * it forces everyone through again. The version key is written *before* the
 * reload so a failure partway through (or the reload itself) can never loop.
 * Skipped entirely on a browser without Cache/ServiceWorker support -- there's
 * nothing to flush there.
 */
async function flushIfStaleVersion(): Promise<boolean> {
  if (typeof caches === 'undefined' || !('serviceWorker' in navigator)) return false
  if (localStorage.getItem(GATE_VERSION_KEY) === GATE_VERSION) return false

  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('scoutsnf.')) localStorage.removeItem(key)
    }

    const cacheKeys = await caches.keys()
    await Promise.all(cacheKeys.map((key) => caches.delete(key)))

    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
  } catch {
    // best-effort cleanup -- still write the version key and reload below
  }

  localStorage.setItem(GATE_VERSION_KEY, GATE_VERSION)
  window.location.reload()
  return true
}

export default function AccessGate({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('loading')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void init()

    async function init() {
      const reloading = await flushIfStaleVersion()
      if (reloading) return

      const identity = loadIdentity()
      if (!identity) {
        setScreen('form')
        return
      }

      const result = await checkIn(identity, 'open')
      if (result === true) {
        setLastCheck(Date.now())
        setScreen('ok')
        return
      }
      if (result === false) {
        clearIdentity()
        setScreen('ended')
        return
      }

      const lastCheck = getLastCheck()
      const withinGrace = lastCheck != null && Date.now() - lastCheck <= OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000
      setScreen(withinGrace ? 'ok' : 'offline')
    }
  }, [])

  function validate(): string | null {
    if (name.trim().length < 2) return 'Enter your full name.'
    if (!EMAIL_RE.test(email.trim().toLowerCase())) return 'Enter a valid email address.'
    return null
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSubmitting(true)
    const identity: Identity = { name: name.trim(), email: email.trim().toLowerCase(), device: makeDeviceId() }
    const result = await checkIn(identity, 'first sign-in')
    setSubmitting(false)

    if (result === false) {
      setScreen('ended')
      return
    }
    saveIdentity(identity)
    setLastCheck(Date.now())
    setScreen('ok')
  }

  if (screen === 'loading') return null
  if (screen === 'ok') return <>{children}</>

  // Matches the app's own design system exactly (same Tailwind theme, same brand/gold tokens,
  // same input/button/panel patterns as SearchBar.tsx and SettingsMenu.tsx) rather than a
  // hand-rolled parallel palette -- so it never drifts from how the rest of the app actually
  // looks, including automatic light/dark switching via the same prefers-color-scheme behavior.
  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-[22rem] rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center gap-2">
          <img src={`${import.meta.env.BASE_URL}brand/icon.svg`} alt="" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100">ScoutSNF</span>
        </div>

        {screen === 'form' && (
          <form className="flex flex-col" onSubmit={handleSubmit} noValidate>
            <h1 className="mb-3 text-base font-semibold text-slate-900 dark:text-slate-100">Sign in to continue</h1>
            <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor="sg-name">
              Full name
            </label>
            <input
              id="sg-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <label className="mt-3 text-xs text-slate-500 dark:text-slate-400" htmlFor="sg-email">
              Email
            </label>
            <input
              id="sg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="mt-4 w-full rounded-lg bg-brand py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {submitting ? 'Signing in…' : 'Continue'}
            </button>
          </form>
        )}

        {screen === 'ended' && (
          <div>
            <h1 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">Access ended</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">Your access to ScoutSNF has ended.</p>
          </div>
        )}

        {screen === 'offline' && (
          <div>
            <h1 className="mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">Connect to continue</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ScoutSNF couldn't reach the sign-in server. Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full rounded-lg bg-brand py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Reload
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
