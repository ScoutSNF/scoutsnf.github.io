import { useEffect, useState } from 'react'
import { fetchOwnership, type OwnershipRecord } from '../data/ownership'

/**
 * Fetches (and IndexedDB-caches) a facility's ownership records once `enabled`.
 *
 * Keyed only on [ccn, enabled] -- both primitives, so this only re-runs on a real value change,
 * never on incidental re-renders. Resetting `records`/`error` synchronously at the top of the
 * effect (rather than gating on "already have records") matters specifically for callers like
 * AnchorCard that reuse the same component instance across a changing `ccn`: without the reset,
 * the previous facility's records would stick around and block ever fetching the new one.
 * FacilityRow doesn't hit this (each row is its own instance per facility, so `ccn` never
 * changes within one), but the fix applies the same way there at no extra cost.
 */
export function useOwnership(ccn: string, enabled: boolean) {
  const [records, setRecords] = useState<OwnershipRecord[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setRecords(null)
    setError(false)
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
  }, [ccn, enabled])

  return { records, loading: enabled && records == null && !error, error }
}
