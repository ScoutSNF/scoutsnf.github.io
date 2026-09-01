import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadGeocodeCache, saveGeocodeCache, resolveCoordinatesWithCache, type GeocodeCache } from './geocodeCache.js'
import type { GeocodeInput } from './geocode.js'

const input: GeocodeInput = { id: 'A1', address: '1 Main St', city: 'Springfield', state: 'IL', zip: '62701' }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadGeocodeCache / saveGeocodeCache', () => {
  it('round-trips through disk and returns an empty cache when the file does not exist', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'roster-cache-'))
    const cachePath = path.join(dir, 'geocode-cache.json')
    try {
      expect(await loadGeocodeCache(cachePath)).toEqual({})

      const cache: GeocodeCache = { abc: { latitude: 40.1, longitude: -89.1, approximate: false, cachedAt: '2026-01-01T00:00:00.000Z' } }
      await saveGeocodeCache(cache, cachePath)
      expect(await loadGeocodeCache(cachePath)).toEqual(cache)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('resolveCoordinatesWithCache', () => {
  it('serves a cached address without making any network call', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    // Cache is keyed by a hash of the normalized address, not the input id -- pre-populate by
    // running once against a mocked network, then re-run with a fresh fetch spy to prove the
    // second call hits the cache instead.
    const cache: GeocodeCache = {}
    const csv = `${input.id},"1 Main St, Springfield, IL 62701",Match,Exact,"1 Main St, Springfield, IL, 62701","-89.6,39.8"`
    fetchSpy.mockResolvedValueOnce(new Response(csv, { status: 200 }))
    await resolveCoordinatesWithCache([input], cache)
    expect(cache).not.toEqual({})

    const fetchSpy2 = vi.fn()
    vi.stubGlobal('fetch', fetchSpy2)
    const results = await resolveCoordinatesWithCache([input], cache)
    expect(results.get(input.id)).toEqual({ latitude: 39.8, longitude: -89.6, approximate: false })
    expect(fetchSpy2).not.toHaveBeenCalled()
  })

  it('geocodes and caches a genuinely new address via the Census batch endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(`${input.id},"1 Main St, Springfield, IL 62701",Match,Exact,"1 Main St, Springfield, IL, 62701","-89.6,39.8"`, { status: 200 })
    )
    vi.stubGlobal('fetch', fetchSpy)

    const cache: GeocodeCache = {}
    const results = await resolveCoordinatesWithCache([input], cache)
    expect(results.get(input.id)).toEqual({ latitude: 39.8, longitude: -89.6, approximate: false })
    expect(Object.keys(cache)).toHaveLength(1)
  })

  it('falls back to Nominatim for a Census miss and still caches the result', async () => {
    const fetchSpy = vi
      .fn()
      // Census batch: no match for this address.
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      // Nominatim single-address fallback.
      .mockResolvedValueOnce(new Response(JSON.stringify([{ lat: '39.9', lon: '-89.7' }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const cache: GeocodeCache = {}
    const results = await resolveCoordinatesWithCache([input], cache)
    expect(results.get(input.id)).toEqual({ latitude: 39.9, longitude: -89.7, approximate: true })
    expect(Object.keys(cache)).toHaveLength(1)
  })
})
