import { withCorsProxyIfNeeded } from './corsProxy'

export class SourceFetchError extends Error {
  constructor(public sourceLabel: string, message: string) {
    super(message)
    this.name = 'SourceFetchError'
  }
}

export interface FetchRetryOptions {
  attempts?: number
  /** Abort a stalled attempt after this long, so a dead connection can't hang forever. */
  timeoutMs?: number
  /** Called before each retry (not the first attempt) with the upcoming attempt number. */
  onRetry?: (attempt: number, attempts: number) => void
}

/** Fetch with a per-attempt timeout and exponential backoff. Throws SourceFetchError with a UI-friendly label on exhaustion. */
export async function fetchWithRetry(
  url: string,
  sourceLabel: string,
  init?: RequestInit,
  options?: FetchRetryOptions
): Promise<Response> {
  const attempts = options?.attempts ?? 4
  const timeoutMs = options?.timeoutMs ?? 20_000
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(withCorsProxyIfNeeded(url), { ...init, signal: controller.signal })
      if (!res.ok) {
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
  throw new SourceFetchError(
    sourceLabel,
    `${sourceLabel} unavailable — retry (${(lastErr as Error)?.message ?? 'unknown error'})`
  )
}
