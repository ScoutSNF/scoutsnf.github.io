import { db } from './db'

const PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY as string | undefined

export interface PlaceInfo {
  website: string | null
  photoUrl: string | null
}

let sdkLoadPromise: Promise<typeof google | null> | null = null

function loadPlacesSdk(): Promise<typeof google | null> {
  if (!PLACES_KEY) return Promise.resolve(null)
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve) => {
    if (typeof google !== 'undefined' && google.maps?.places) {
      resolve(google)
      return
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${PLACES_KEY}&libraries=places&loading=async`
    script.async = true
    script.onload = () => resolve(typeof google !== 'undefined' ? google : null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
  return sdkLoadPromise
}

/** Website + real cover photo via the paid Google Places API — only attempted if a key is configured. */
async function lookupViaGooglePlaces(name: string, city: string, state: string): Promise<PlaceInfo | null> {
  const g = await loadPlacesSdk()
  if (!g?.maps?.places) return null

  return new Promise((resolve) => {
    const div = document.createElement('div')
    const service = new g.maps.places.PlacesService(div)
    service.textSearch({ query: `${name} ${city} ${state}` }, (results, status) => {
      if (status !== g.maps.places.PlacesServiceStatus.OK || !results?.[0]?.place_id) {
        resolve(null)
        return
      }
      service.getDetails(
        { placeId: results[0].place_id, fields: ['website', 'photos'] },
        (place, detailStatus) => {
          if (detailStatus !== g.maps.places.PlacesServiceStatus.OK || !place) {
            resolve(null)
            return
          }
          resolve({
            website: place.website ?? null,
            photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 480 }) ?? null
          })
        }
      )
    })
  })
}

/**
 * Looks up a cover photo and website via the optional paid Google Places key.
 * Cached in IndexedDB by CCN so each facility is only ever looked up once per
 * browser. Without a configured key (the default), returns nulls and the UI
 * falls back to the initials avatar rather than risk showing a mismatched photo
 * (Wikipedia's free lookup was previously used as a fallback here but was
 * unreliable — a search match doesn't reliably mean the same facility).
 */
export async function lookupPlaceInfo(
  ccn: string,
  name: string,
  city: string,
  state: string
): Promise<PlaceInfo | null> {
  const cached = await db.places.get(ccn)
  // A cached photo without a Places key configured must be a stale result from the
  // now-removed Wikipedia fallback — don't trust it, re-resolve instead of showing it.
  if (cached && (PLACES_KEY || cached.photoUrl == null)) {
    return { website: cached.website, photoUrl: cached.photoUrl }
  }

  const result: PlaceInfo = PLACES_KEY
    ? (await lookupViaGooglePlaces(name, city, state)) ?? { website: null, photoUrl: null }
    : { website: null, photoUrl: null }

  await db.places.put({ ccn, website: result.website, photoUrl: result.photoUrl, fetchedAt: new Date().toISOString() })
  return result
}

export const placesEnabled = Boolean(PLACES_KEY)
