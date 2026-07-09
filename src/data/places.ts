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

/** Looks up a website + cover photo via Places JS SDK. Non-blocking, cached in IndexedDB by CCN. */
export async function lookupPlaceInfo(
  ccn: string,
  name: string,
  city: string,
  state: string
): Promise<PlaceInfo | null> {
  if (!PLACES_KEY) return null

  const cached = await db.places.get(ccn)
  if (cached) return { website: cached.website, photoUrl: cached.photoUrl }

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
          const website = place.website ?? null
          const photoUrl = place.photos?.[0]?.getUrl({ maxWidth: 480 }) ?? null
          void db.places.put({ ccn, website, photoUrl, fetchedAt: new Date().toISOString() })
          resolve({ website, photoUrl })
        }
      )
    })
  })
}

export const placesEnabled = Boolean(PLACES_KEY)
