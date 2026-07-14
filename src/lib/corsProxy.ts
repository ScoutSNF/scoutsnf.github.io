/**
 * Three of this app's data sources don't send an Access-Control-Allow-Origin
 * header, so browsers refuse to read their responses cross-origin — confirmed
 * in production, not a parsing bug:
 *  - data.cms.gov (Provider Data Catalog: SNF/hospital rosters, bed counts)
 *  - geocoding.geo.census.gov (batch geocoder, used for the hospital roster)
 *  - nominatim.openstreetmap.org (single-address fallback geocoder, used for
 *    addresses the Census batch geocoder can't match)
 * There is no client-only workaround for a missing CORS header, so GET and
 * POST requests to these hosts are relayed through a dedicated Cloudflare
 * Worker that adds the header (see cloudflare-worker/cors-proxy.js). A
 * public relay (api.allorigins.win) was tried first but proved unreliable
 * (intermittent CORS failures and timeouts of its own).
 *
 * NOTE: the worker's own ALLOWED_HOSTS must include a host listed here too,
 * or it 403s the relay — the worker is deployed separately from this app, so
 * adding a host here alone isn't enough; the worker needs a matching redeploy.
 *
 * Override with VITE_CMS_PROXY_BASE to point at a different proxy — it
 * should accept `?url=<encoded target>`, forward the method/body, and
 * return the target's response with CORS headers added.
 */
const PROXIED_HOSTS = ['data.cms.gov', 'geocoding.geo.census.gov', 'nominatim.openstreetmap.org']

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
