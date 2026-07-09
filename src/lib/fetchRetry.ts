export class SourceFetchError extends Error {
  constructor(public sourceLabel: string, message: string) {
    super(message)
    this.name = 'SourceFetchError'
  }
}

/** Fetch with exponential backoff. Throws SourceFetchError with a UI-friendly label on exhaustion. */
export async function fetchWithRetry(
  url: string,
  sourceLabel: string,
  init?: RequestInit,
  attempts = 4
): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      return res
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        const delay = 500 * 2 ** i
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw new SourceFetchError(
    sourceLabel,
    `${sourceLabel} unavailable — retry (${(lastErr as Error)?.message ?? 'unknown error'})`
  )
}
