/**
 * CORS proxy for government data sources that don't send an
 * Access-Control-Allow-Origin header, deployed as a Cloudflare Worker.
 *
 *  - data.cms.gov (Provider Data Catalog: SNF/hospital rosters, bed counts)
 *  - geocoding.geo.census.gov (batch geocoder, used for the hospital roster)
 *
 * Forwards the request's method and body (needed for the geocoder's
 * multipart POST) to the target URL, then re-serves the response with CORS
 * headers added. Only ever proxies the two allow-listed hosts, so it can't
 * be used as an open proxy for arbitrary sites.
 *
 * Deployed at: https://scoutsnf-cms-proxy.shalomalizakatz.workers.dev
 * Referenced by: src/lib/corsProxy.ts (VITE_CMS_PROXY_BASE override)
 */
const ALLOWED_HOSTS = ['data.cms.gov', 'geocoding.geo.census.gov']

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

    const init = { method: request.method }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.arrayBuffer()
      const contentType = request.headers.get('Content-Type')
      if (contentType) init.headers = { 'Content-Type': contentType }
    }

    const upstream = await fetch(targetUrl, init)
    const body = await upstream.arrayBuffer()

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': request.method === 'GET' ? 'public, max-age=3600' : 'no-store'
      }
    })
  }
}
