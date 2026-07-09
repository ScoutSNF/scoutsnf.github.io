import { CENSUS_GEOCODE_BATCH_URL, NOMINATIM_SEARCH_URL } from './sources'
import { fetchWithRetry } from '../lib/fetchRetry'
import { parseCsv } from '../lib/csv'

export interface GeocodeInput {
  id: string
  address: string
  city: string
  state: string
  zip: string
}

export interface GeocodeResult {
  latitude: number
  longitude: number
  approximate: boolean
}

const BATCH_CHUNK_SIZE = 500

function csvField(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function buildBatchCsv(inputs: GeocodeInput[]): string {
  return inputs
    .map((r) => [r.id, r.address, r.city, r.state, r.zip].map(csvField).join(','))
    .join('\n')
}

async function geocodeChunk(inputs: GeocodeInput[]): Promise<Map<string, GeocodeResult>> {
  const results = new Map<string, GeocodeResult>()
  const csv = buildBatchCsv(inputs)
  const form = new FormData()
  form.append('addressFile', new Blob([csv], { type: 'text/csv' }), 'addresses.csv')
  form.append('benchmark', 'Public_AR_Current')
  form.append('returntype', 'locations')

  const res = await fetchWithRetry(CENSUS_GEOCODE_BATCH_URL, 'Census geocoder', {
    method: 'POST',
    body: form
  })
  const text = await res.text()
  const rows = parseCsv(text)
  for (const row of rows) {
    const [id, , matchIndicator, , , coordinates] = row
    if (matchIndicator?.toLowerCase() !== 'match') continue
    const [lonStr, latStr] = (coordinates ?? '').split(',')
    const lon = Number(lonStr)
    const lat = Number(latStr)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      results.set(id, { latitude: lat, longitude: lon, approximate: false })
    }
  }
  return results
}

/** Batch-geocodes addresses via the Census geocoder, chunked to stay within request-size limits. */
export async function geocodeBatch(
  inputs: GeocodeInput[],
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, GeocodeResult>> {
  const merged = new Map<string, GeocodeResult>()
  for (let i = 0; i < inputs.length; i += BATCH_CHUNK_SIZE) {
    const chunk = inputs.slice(i, i + BATCH_CHUNK_SIZE)
    try {
      const chunkResults = await geocodeChunk(chunk)
      for (const [id, r] of chunkResults) merged.set(id, r)
    } catch {
      // leave this chunk's misses for the Nominatim fallback
    }
    onProgress?.(Math.min(i + BATCH_CHUNK_SIZE, inputs.length), inputs.length)
  }
  return merged
}

let lastNominatimCall = 0

/** Nominatim usage policy requires <=1 req/sec and an identifying param; used only for Census misses. */
export async function geocodeSingleNominatim(input: GeocodeInput): Promise<GeocodeResult | null> {
  const now = Date.now()
  const wait = Math.max(0, lastNominatimCall + 1100 - now)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastNominatimCall = Date.now()

  const q = `${input.address}, ${input.city}, ${input.state} ${input.zip}`
  const url = `${NOMINATIM_SEARCH_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`
  try {
    const res = await fetchWithRetry(url, 'Nominatim geocoder', {}, 2)
    const json = (await res.json()) as Array<{ lat: string; lon: string }>
    if (json.length === 0) return null
    return { latitude: Number(json[0].lat), longitude: Number(json[0].lon), approximate: true }
  } catch {
    return null
  }
}
