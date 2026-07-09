/**
 * data.cms.gov's Provider Data Catalog API does not send an
 * Access-Control-Allow-Origin header, so browsers refuse to read its
 * responses cross-origin — confirmed in production, not a parsing bug.
 * There is no client-only workaround for a missing CORS header, so GET
 * requests to this host are relayed through a CORS-adding proxy instead.
 *
 * Set VITE_CMS_PROXY_BASE to point at a dedicated proxy you control (it
 * should accept `?url=<encoded target>` and return the target's body with
 * CORS headers added) once you have one; it defaults to a public relay.
 */
const PROXIED_HOSTS = ['data.cms.gov']

const PROXY_BASE =
  (import.meta.env.VITE_CMS_PROXY_BASE as string | undefined) || 'https://api.allorigins.win/raw?url='

export function withCorsProxyIfNeeded(url: string): string {
  try {
    const { hostname } = new URL(url)
    if (PROXIED_HOSTS.includes(hostname)) {
      return `${PROXY_BASE}${encodeURIComponent(url)}`
    }
  } catch {
    // malformed URL — let fetch() surface the real error instead of masking it here
  }
  return url
}
