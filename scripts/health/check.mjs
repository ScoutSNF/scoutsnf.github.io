/**
 * Production health check.
 *
 * Checks the live site and the live CORS worker, not the repository. Everything this catches has
 * already happened once and was found by a person noticing, weeks later:
 *
 *  - the roster going stale, whether because the weekly pipeline failed, its pull request was
 *    never merged, or the Pages deploy never ran
 *  - the worker being down, un-redeployed, or refused by CMS -- which silently breaks owner
 *    search and the per-facility ownership list while the rest of the app looks fine
 *  - a CMS dataset id changing under us
 *
 * Deliberately dependency-free: plain Node, no npm install, no build. A monitor that needs a
 * working toolchain to tell you something is broken is one more thing that can be broken.
 *
 * Run locally with: node scripts/health/check.mjs
 */

const SITE = process.env.HEALTH_SITE_URL ?? 'https://scoutsnf.github.io'
const PROXY = process.env.HEALTH_PROXY_BASE ?? 'https://scoutsnf-cms-proxy.shalomalizakatz.workers.dev/?url='

/** The roster refreshes weekly; this allows a missed run plus a few days before complaining. */
const MAX_ROSTER_AGE_DAYS = 10

/** CMS Ownership dataset — the one owner search and the ownership dropdown both read. */
const OWNERSHIP_DATASET = 'y2hd-n93e'
const CMS_QUERY = (id, params) =>
  `https://data.cms.gov/provider-data/api/1/datastore/query/${id}/0?${new URLSearchParams(params)}`

const TIMEOUT_MS = 30_000

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function get(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'ScoutSNF-health-check/1.0' } })
    const text = await res.text()
    return { status: res.status, text }
  } finally {
    clearTimeout(timer)
  }
}

/** The data the live site actually serves is fresh. */
async function checkRosterFreshness() {
  const url = `${SITE}/data/roster-manifest.json`
  let res
  try {
    res = await get(url)
  } catch (err) {
    return record('Live roster reachable', false, `${url} — ${err.message}`)
  }
  if (res.status !== 200) return record('Live roster reachable', false, `HTTP ${res.status} from ${url}`)

  let manifest
  try {
    manifest = JSON.parse(res.text)
  } catch {
    return record('Live roster parses', false, `not JSON: ${res.text.slice(0, 120)}`)
  }

  const builtAt = new Date(manifest.built_at)
  if (Number.isNaN(builtAt.getTime())) {
    return record('Live roster has a build date', false, `unparseable built_at: ${manifest.built_at}`)
  }
  const ageDays = (Date.now() - builtAt.getTime()) / 86_400_000
  record(
    'Live roster is fresh',
    ageDays <= MAX_ROSTER_AGE_DAYS,
    `built ${builtAt.toISOString().slice(0, 10)}, ${ageDays.toFixed(1)} days old (limit ${MAX_ROSTER_AGE_DAYS}) — ` +
      `${manifest.snf?.count?.toLocaleString() ?? '?'} SNFs, ${manifest.hospital?.count?.toLocaleString() ?? '?'} hospitals`
  )
}

/**
 * The browser's only route to CMS. A plain `limit=1` proves the whole chain at once: the worker
 * is up, its allowlist still covers CMS, CMS is not refusing it, and the dataset id is still live.
 */
async function checkWorkerRelay() {
  const target = CMS_QUERY(OWNERSHIP_DATASET, { limit: '1', offset: '0' })
  let res
  try {
    res = await get(`${PROXY}${encodeURIComponent(target)}`)
  } catch (err) {
    return record('CORS worker relays CMS', false, `worker unreachable — ${err.message}`)
  }
  if (res.status !== 200) {
    return record(
      'CORS worker relays CMS',
      false,
      `HTTP ${res.status} — ${res.text.replace(/\s+/g, ' ').trim().slice(0, 200)}`
    )
  }
  let json
  try {
    json = JSON.parse(res.text)
  } catch {
    return record('CORS worker relays CMS', false, `not JSON: ${res.text.slice(0, 120)}`)
  }
  const rows = json.results?.length ?? 0
  record('CORS worker relays CMS', rows > 0, rows > 0 ? `dataset ${OWNERSHIP_DATASET} returned a row` : 'returned no rows — dataset id may have changed')
}

/** The exact query shape the owner-search box issues, so the user-facing path is covered too. */
async function checkOwnerSearch() {
  const target = CMS_QUERY(OWNERSHIP_DATASET, {
    limit: '10',
    offset: '0',
    'conditions[0][property]': 'owner_name',
    'conditions[0][value]': '%management%',
    'conditions[0][operator]': 'LIKE'
  })
  let res
  try {
    res = await get(`${PROXY}${encodeURIComponent(target)}`)
  } catch (err) {
    return record('Owner name search works', false, `unreachable — ${err.message}`)
  }
  // Only the status and shape are asserted: how many owners match a given word is CMS's business
  // and would make this alert on data changes rather than outages.
  if (res.status !== 200) {
    return record('Owner name search works', false, `HTTP ${res.status} — ${res.text.replace(/\s+/g, ' ').trim().slice(0, 200)}`)
  }
  try {
    const json = JSON.parse(res.text)
    record('Owner name search works', Array.isArray(json.results), `${json.results?.length ?? 0} match(es) for "management"`)
  } catch {
    record('Owner name search works', false, `not JSON: ${res.text.slice(0, 120)}`)
  }
}

/**
 * `HEALTH_ONLY=worker` runs just the worker checks. The worker deploy uses it to confirm its own
 * deploy: a stale roster is a real problem, but it is not a reason to call a good worker deploy
 * a failure.
 */
const ONLY = process.env.HEALTH_ONLY ?? 'all'

console.log(`Checking ${SITE}${ONLY === 'all' ? '' : ` (${ONLY} checks only)`}\n`)
if (ONLY === 'all') await checkRosterFreshness()
await checkWorkerRelay()
await checkOwnerSearch()

const failed = results.filter((r) => !r.ok)
const summary = [
  `## Production health check`,
  '',
  ...results.map((r) => `- ${r.ok ? '✅' : '❌'} **${r.name}** — ${r.detail ?? ''}`),
  ''
]
if (failed.length > 0) {
  summary.push(
    'The repository may be perfectly fine: these check the deployed site and the hand-deployed',
    'Cloudflare worker, which can drift from it.',
    ''
  )
}
console.log(`\n${failed.length === 0 ? 'All checks passed.' : `${failed.length} check(s) failed.`}`)

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs')
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n')
}
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import('node:fs')
  // Passed to the issue step, which needs the detail in the issue body.
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `failed=${failed.length}\nreport<<HEALTH_EOF\n${summary.join('\n')}\nHEALTH_EOF\n`
  )
}

process.exit(failed.length > 0 ? 1 : 0)
