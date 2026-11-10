/**
 * CORS proxy for government/OSM data sources that don't send an
 * Access-Control-Allow-Origin header, deployed as a Cloudflare Worker.
 *
 *  - data.cms.gov (Provider Data Catalog: SNF/hospital rosters, bed counts)
 *  - geocoding.geo.census.gov (batch geocoder, used for the hospital roster)
 *  - nominatim.openstreetmap.org (single-address fallback geocoder)
 *
 * Forwards the request's method and body (needed for the geocoder's
 * multipart POST) to the target URL, then re-serves the response with CORS
 * headers added. Only ever proxies the allow-listed hosts, so it can't
 * be used as an open proxy for arbitrary sites.
 *
 * Deployed at: https://scoutsnf-cms-proxy.shalomalizakatz.workers.dev
 * Referenced by: src/lib/corsProxy.ts (VITE_CMS_PROXY_BASE override)
 */
// Exported so cors-proxy.test.js can assert every host here gets an identified request --
// adding a host without one is the bug that broke owner search, and the test now catches it.
// Cloudflare only ever reads the default export, so this changes nothing at runtime.
export const ALLOWED_HOSTS = ['data.cms.gov', 'geocoding.geo.census.gov', 'nominatim.openstreetmap.org']

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      })
    }

    const targetUrl = new URL(request.url).searchParams.get('url')
    if (!targetUrl) {
      return new Response('Missing url param', { status: 400 })
    }

    let targetHost
    try {
      targetHost = new URL(targetUrl).hostname
    } catch {
      return new Response('Invalid url param', { status: 400 })
    }
    if (!ALLOWED_HOSTS.includes(targetHost)) {
      return new Response('Forbidden', { status: 403 })
    }

    // Every relayed request identifies itself. A Worker's fetch() sends no User-Agent unless
    // one is set, and this object starts empty, so without this the target sees an anonymous
    // client — which is the first thing an API rate-limiter blocks. data.cms.gov began
    // refusing unidentified traffic with a flat 403 in late October 2026; it broke the roster
    // pipeline (fixed separately in scripts/roster/fetchRetry.ts) and it breaks every CMS call
    // relayed through here, which is what powers owner search and the per-facility ownership
    // list. Nominatim has always needed this and keeps its contact address, as its usage
    // policy asks for one: https://operations.osmfoundation.org/policies/nominatim/
    const init = {
      method: request.method,
      headers: { 'User-Agent': 'ScoutSNF/1.0 (+https://github.com/ScoutSNF/scoutsnf.github.io)' }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer()
      const contentType = request.headers.get('Content-Type')
      if (contentType) init.headers['Content-Type'] = contentType
    }
    if (targetHost === 'nominatim.openstreetmap.org') {
      init.headers['User-Agent'] = 'ScoutSNF/1.0 (+https://scoutsnf.github.io; contact: shalomalizakatz@gmail.com)'
    }

    const upstream = await fetch(targetUrl, init)
    const body = await upstream.arrayBuffer()

    // Only cache successful responses — caching an error (e.g. a transient upstream
    // failure, or a rejection that gets fixed server-side minutes later) would keep
    // serving that same failure from the browser's disk cache and Cloudflare's edge
    // cache for up to an hour, long after the real problem is gone. Confirmed in
    // production: stale cached 403s kept appearing after the underlying fix shipped.
    const cacheable = request.method === 'GET' && upstream.status >= 200 && upstream.status < 300

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': cacheable ? 'public, max-age=3600' : 'no-store'
      }
    })
  }
}
