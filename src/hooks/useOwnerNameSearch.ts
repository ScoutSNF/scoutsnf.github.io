import { useEffect, useState } from 'react'
import { searchOwnersByName, type OwnerSearchHit } from '../data/ownership'

const MIN_CHARS = 3
const DEBOUNCE_MS = 400

/**
 * Debounced live search of the CMS Ownership dataset by owner/manager name. Unlike the local
 * roster search (instant, in-memory), this hits the network per query, so it only fires once
 * `term` has enough characters to be a useful substring and waits out a debounce window before
 * firing -- otherwise every keystroke would kick off its own request.
 */
export function useOwnerNameSearch(term: string, enabled: boolean) {
  const [hits, setHits] = useState<OwnerSearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    setHits([])
    setError(false)
    if (!enabled || term.trim().length < MIN_CHARS) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchOwnersByName(term.trim())
        .then((r) => {
          if (!cancelled) {
            setHits(r)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(true)
            setLoading(false)
          }
        })
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term, enabled])

  return { hits, loading, error }
}
