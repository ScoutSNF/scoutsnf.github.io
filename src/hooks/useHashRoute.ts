import { useCallback, useEffect, useState } from 'react'
import { parseRoute, routeToHash, type AppRoute } from '../lib/routing'

/**
 * Keeps app state and the URL hash in step, in both directions.
 *
 * Reads the hash on mount so a pasted link lands on the right facility, listens for `hashchange`
 * so the browser's Back and Forward buttons restore state, and writes back when the app navigates.
 *
 * Writes use `replaceState` when only the facility changes within the same view, so stepping
 * through six facilities does not bury the previous view under six history entries — Back should
 * return to where someone came from, not walk their whole search session backwards.
 */
export function useHashRoute(): [AppRoute, (next: AppRoute, replace?: boolean) => void] {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRoute(typeof window === 'undefined' ? '' : window.location.hash)
  )

  useEffect(() => {
    function onHashChange() {
      setRoute(parseRoute(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next: AppRoute, replace = false) => {
    const hash = routeToHash(next)
    if (window.location.hash === hash) {
      // Still sync state: the hash can already match when arriving from a hashchange.
      setRoute(next)
      return
    }
    const url = `${window.location.pathname}${window.location.search}${hash}`
    if (replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
    setRoute(next)
  }, [])

  return [route, navigate]
}
