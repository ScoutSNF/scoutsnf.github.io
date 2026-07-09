import { useEffect, useRef, useState } from 'react'
import { lookupPlaceInfo, placesEnabled, type PlaceInfo } from '../data/places'

/** Fetches Places website/photo only once the element scrolls into view. No-op if no API key configured. */
export function useLazyPlaceInfo(ccn: string, name: string, city: string, state: string) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [info, setInfo] = useState<PlaceInfo | null>(null)

  useEffect(() => {
    if (!placesEnabled || !ref.current) return
    let cancelled = false
    const el = ref.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect()
          void lookupPlaceInfo(ccn, name, city, state).then((result) => {
            if (!cancelled) setInfo(result)
          })
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [ccn, name, city, state])

  return { ref, info }
}
