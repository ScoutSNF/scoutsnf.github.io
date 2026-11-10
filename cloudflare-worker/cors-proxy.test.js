import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import worker, { ALLOWED_HOSTS } from './cors-proxy.js'

/**
 * The worker is the only route the browser has to these APIs, and it is deployed by hand, so a
 * regression here is invisible until a user hits it. That is exactly what happened: it forwarded
 * requests to data.cms.gov with no User-Agent, CMS started refusing anonymous clients with a 403,
 * and owner search broke silently for everyone.
 */

const PROXY = 'https://scoutsnf-cms-proxy.example.workers.dev/'

/** The URL the app asks the worker to relay, wrapped the way src/lib/corsProxy.ts wraps it. */
function proxied(target) {
  return `${PROXY}?url=${encodeURIComponent(target)}`
}

let upstream

beforeEach(() => {
  upstream = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', upstream)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Headers the worker passed to its own fetch() on the Nth upstream call. */
function sentHeaders(call = 0) {
  return upstream.mock.calls[call][1].headers
}

describe('cors-proxy worker', () => {
  // The regression itself. Looping over the real exported list means a host added later
  // without an identified request fails here rather than in production.
  it.each(ALLOWED_HOSTS)('identifies itself to %s', async (host) => {
    await worker.fetch(new Request(proxied(`https://${host}/some/path?a=1`)))
    expect(upstream).toHaveBeenCalledOnce()
    const ua = sentHeaders()['User-Agent']
    expect(ua, `no User-Agent sent to ${host}`).toBeTruthy()
    expect(ua).toMatch(/ScoutSNF/)
  })

  it('sends Nominatim a contact address, as its usage policy asks', async () => {
    await worker.fetch(new Request(proxied('https://nominatim.openstreetmap.org/search?q=x')))
    expect(sentHeaders()['User-Agent']).toMatch(/contact:/)
  })

  it('relays the target URL unchanged', async () => {
    const target = 'https://data.cms.gov/provider-data/api/1/datastore/query/y2hd-n93e/0?limit=100'
    await worker.fetch(new Request(proxied(target)))
    expect(upstream.mock.calls[0][0]).toBe(target)
  })

  it('keeps identifying itself on a POST, and still forwards the body and content type', async () => {
    const target = 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch'
    await worker.fetch(
      new Request(proxied(target), { method: 'POST', body: 'addr', headers: { 'Content-Type': 'text/csv' } })
    )
    const headers = sentHeaders()
    expect(headers['User-Agent']).toMatch(/ScoutSNF/)
    expect(headers['Content-Type']).toBe('text/csv')
    expect(upstream.mock.calls[0][1].method).toBe('POST')
  })

  // Not an open proxy: the allowlist is what stops this being one.
  it('refuses a host that is not on the allowlist, without calling it', async () => {
    const res = await worker.fetch(new Request(proxied('https://evil.example.com/steal')))
    expect(res.status).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects a missing or malformed url parameter', async () => {
    expect((await worker.fetch(new Request(PROXY))).status).toBe(400)
    expect((await worker.fetch(new Request(`${PROXY}?url=not-a-url`))).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('adds the CORS header the browser needs, which is the whole point of the relay', async () => {
    const res = await worker.fetch(new Request(proxied('https://data.cms.gov/x')))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('answers a preflight without calling upstream', async () => {
    const res = await worker.fetch(new Request(proxied('https://data.cms.gov/x'), { method: 'OPTIONS' }))
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(upstream).not.toHaveBeenCalled()
  })

  // A cached failure outlives the fix: a 403 stored for an hour kept being served from the edge
  // and from browser disk caches long after the underlying problem was resolved.
  it('never caches an upstream failure', async () => {
    upstream.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }))
    const res = await worker.fetch(new Request(proxied('https://data.cms.gov/x')))
    expect(res.status).toBe(403)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('caches a successful GET', async () => {
    const res = await worker.fetch(new Request(proxied('https://data.cms.gov/x')))
    expect(res.headers.get('Cache-Control')).toMatch(/max-age=\d+/)
  })
})
