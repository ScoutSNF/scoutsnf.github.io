/**
 * CORS proxy for data.cms.gov, deployed as a Cloudflare Worker.
 *
 * data.cms.gov's Provider Data Catalog API (metastore, datastore query,
 * data-api, and data.json) sends no Access-Control-Allow-Origin header, so
 * browsers refuse to read its responses cross-origin. This Worker fetches
 * the requested data.cms.gov URL server-side and re-serves it with CORS
 * headers added. It only ever proxies data.cms.gov, so it can't be used as
 * an open proxy for arbitrary sites.
 *
 * Deployed at: https://scoutsnf-cms-proxy.shalomalizakatz.workers.dev
 * Referenced by: src/lib/corsProxy.ts (VITE_CMS_PROXY_BASE override)
 */
export default {
  async fetch(request) {
    const targetUrl = new URL(request.url).searchParams.get('url')
    if (!targetUrl || !new URL(targetUrl).hostname.endsWith('data.cms.gov')) {
      return new Response('Forbidden', { status: 403 })
    }
    const upstream = await fetch(targetUrl)
    const body = await upstream.arrayBuffer()
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  }
}
