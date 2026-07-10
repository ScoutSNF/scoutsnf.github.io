/**
 * Two of this app's government data sources don't send an
 * Access-Control-Allow-Origin header, so browsers refuse to read their
 * responses cross-origin — confirmed in production, not a parsing bug:
 *  - data.cms.gov (Provider Data Catalog: SNF/hospital rosters, bed counts)
 *  - geocoding.geo.census.gov (batch geocoder, used for the hospital roster)
 * There is no client-only workaround for a missing CORS header, so GET and
 * POST requests to these hosts are relayed through a dedicated Cloudflare
 * Worker that adds the header (see cloudflare-worker/cors-proxy.js). A
 * public relay (api.allorigins.win) was tried first but proved unreliable
 * (intermittent CORS failures and timeouts of its own).
 *
 * Override with VITE_CMS_PROXY_BASE to point at a different proxy — it
 * should accept `?url=<encoded target>`, forward the method/body, and
 * return the target's response with CORS headers added.
 */
const PROXIED_HOSTS = ['data.cms.gov', 'geocoding.geo.census.gov']

const PROXY_BASE =
  (import.meta.env.VITE_CMS_PROXY_BASE as string | undefined) ||
  'https://scoutsnf-cms-proxy.shalomalizakatz.workers.dev/?url='

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
