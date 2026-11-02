export class SourceFetchError extends Error {
  constructor(
    public sourceLabel: string,
    message: string,
    /** HTTP status of the last attempt, when it got far enough to have one. */
    public status?: number,
    /** The URL that failed, so a changed or moved endpoint is visible in the log. */
    public url?: string,
    /** First part of the response body -- CMS puts the actual reason here on a 403. */
    public bodySnippet?: string
  ) {
    super(message)
    this.name = 'SourceFetchError'
  }
}

export interface FetchRetryOptions {
  attempts?: number
  /** Abort a stalled attempt after this long, so a dead connection can't hang forever. */
  timeoutMs?: number
  onRetry?: (attempt: number, attempts: number) => void
}

/**
 * Sent on every request this pipeline makes.
 *
 * CMS's endpoints previously got no User-Agent at all, because Node's fetch does not add one.
 * Nominatim has always been sent this header (it rejects requests without one); CMS now gets the
 * same treatment, since an anonymous client is the first thing an API rate-limiter blocks.
 */
const USER_AGENT = 'ScoutSNF-roster-pipeline/1.0 (+https://github.com/ScoutSNF/scoutsnf.github.io)'

/** Host + path only -- query strings carry paging offsets that add noise to an error message. */
function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.host}${u.pathname}`
  } catch {
    return url
  }
}

/**
 * Fetch with a per-attempt timeout and exponential backoff. Port of src/lib/fetchRetry.ts, minus
 * the CORS-proxy wrapper -- that exists solely to work around browsers refusing to read
 * responses without an Access-Control-Allow-Origin header (see src/lib/corsProxy.ts); CI runs
 * server-side and hits these hosts directly, so CORS doesn't apply here at all.
 *
 * On failure the thrown error carries the status, the URL and the start of the response body.
 * Without those a CI log said only "HTTP 403 Forbidden", which is true of a rate limit, a blocked
 * client and a retired endpoint alike, and does not distinguish between them.
 */
export async function fetchWithRetry(url: string, sourceLabel: string, init?: RequestInit, options?: FetchRetryOptions): Promise<Response> {
  const attempts = options?.attempts ?? 4
  const timeoutMs = options?.timeoutMs ?? 20_000
  let lastErr: unknown
  let lastStatus: number | undefined
  let lastBody: string | undefined

  const headers = new Headers(init?.headers)
  if (!headers.has('user-agent')) headers.set('user-agent', USER_AGENT)

  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, headers, signal: controller.signal })
      if (!res.ok) {
        lastStatus = res.status
        // Read it here: the body is consumable once, and by the time the error surfaces the
        // response is long out of scope.
        lastBody = (await res.text().catch(() => ''))
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300)
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      return res
    } catch (err) {
      lastErr = err instanceof DOMException && err.name === 'AbortError' ? new Error('timed out') : err
      if (i < attempts - 1) {
        options?.onRetry?.(i + 2, attempts)
        const delay = 500 * 2 ** i
        await new Promise((r) => setTimeout(r, delay))
      }
    } finally {
      clearTimeout(timer)
    }
  }

  const reason = (lastErr as Error)?.message ?? 'unknown error'
  const parts = [`${sourceLabel} unavailable after ${attempts} attempts`, reason, `at ${shortUrl(url)}`]
  if (lastBody) parts.push(`response: ${lastBody}`)
  throw new SourceFetchError(sourceLabel, parts.join(' — '), lastStatus, url, lastBody)
}
