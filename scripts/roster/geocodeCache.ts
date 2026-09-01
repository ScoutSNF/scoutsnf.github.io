import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { geocodeBatch, geocodeSingleNominatim, type GeocodeInput, type GeocodeResult } from './geocode.js'

export interface GeocodeCacheEntry extends GeocodeResult {
  cachedAt: string
}

export type GeocodeCache = Record<string, GeocodeCacheEntry>

export const DEFAULT_CACHE_PATH = path.resolve('scripts/roster/geocode-cache.json')

function normalizedAddressKey(input: GeocodeInput): string {
  const normalized = `${input.address}|${input.city}|${input.state}|${input.zip}`.toLowerCase().trim().replace(/\s+/g, ' ')
  return createHash('sha256').update(normalized).digest('hex')
}

export async function loadGeocodeCache(cachePath = DEFAULT_CACHE_PATH): Promise<GeocodeCache> {
  try {
    const text = await readFile(cachePath, 'utf8')
    return JSON.parse(text) as GeocodeCache
  } catch {
    return {}
  }
}

/** Sorted keys keep the committed cache file's diffs small and reviewable. */
export async function saveGeocodeCache(cache: GeocodeCache, cachePath = DEFAULT_CACHE_PATH): Promise<void> {
  const sorted: GeocodeCache = {}
  for (const key of Object.keys(cache).sort()) sorted[key] = cache[key]
  await mkdir(path.dirname(cachePath), { recursive: true })
  await writeFile(cachePath, JSON.stringify(sorted, null, 2) + '\n', 'utf8')
}

/**
 * Resolves coordinates for every input, checking the persistent cache first so a re-run only
 * geocodes genuinely new/changed addresses -- this is what makes bulk hospital geocoding
 * Nominatim-policy-compliant (the policy requires caching and forbids repeat systematic
 * geocoding of the same data) while keeping every CI run fast. Mutates `cache` in place with any
 * newly-resolved results; the caller is responsible for persisting it via saveGeocodeCache.
 */
export async function resolveCoordinatesWithCache(
  inputs: GeocodeInput[],
  cache: GeocodeCache,
  onProgress?: (stage: 'batch' | 'fallback', done: number, total: number) => void
): Promise<Map<string, GeocodeResult>> {
  const results = new Map<string, GeocodeResult>()
  const keyByInputId = new Map<string, string>()
  const uncached: GeocodeInput[] = []

  for (const input of inputs) {
    const key = normalizedAddressKey(input)
    keyByInputId.set(input.id, key)
    const cached = cache[key]
    if (cached) {
      results.set(input.id, { latitude: cached.latitude, longitude: cached.longitude, approximate: cached.approximate })
    } else {
      uncached.push(input)
    }
  }

  if (uncached.length === 0) return results

  onProgress?.('batch', 0, uncached.length)
  const geocoded = await geocodeBatch(uncached, (done, total) => onProgress?.('batch', done, total))
  const misses = uncached.filter((i) => !geocoded.has(i.id))

  onProgress?.('fallback', 0, misses.length)
  for (let i = 0; i < misses.length; i++) {
    const result = await geocodeSingleNominatim(misses[i])
    if (result) geocoded.set(misses[i].id, result)
    onProgress?.('fallback', i + 1, misses.length)
  }

  const now = new Date().toISOString()
  for (const [id, result] of geocoded) {
    results.set(id, result)
    const key = keyByInputId.get(id)
    if (key) cache[key] = { ...result, cachedAt: now }
  }

  return results
}
