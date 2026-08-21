import { useEffect, useState } from 'react'
import { fetchOwnership, type OwnershipRecord } from '../data/ownership'

/** Fetches (and IndexedDB-caches) a facility's ownership records only once `enabled`. */
export function useOwnership(ccn: string, enabled: boolean) {
  const [records, setRecords] = useState<OwnershipRecord[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled || records != null || error) return
    let cancelled = false
    fetchOwnership(ccn)
      .then((r) => {
        if (!cancelled) setRecords(r)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [ccn, enabled, records, error])

  return { records, loading: enabled && records == null && !error, error }
}
