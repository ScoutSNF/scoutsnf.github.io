export interface ChowEntry {
  effectiveDate: string // ISO yyyy-mm-dd
  buyerOrg: string
  buyerDba: string
  sellerOrg: string
  sellerDba: string
  chowType: string
}

export interface ChowData {
  releaseDate: string
  coverageStart: string
  coverageEnd: string
  transferCount: number
  entries: Record<string, ChowEntry[]>
}

let cached: Promise<ChowData | null> | null = null

/**
 * Fetches the static CHOW artifact produced by scripts/chow/run.ts (committed alongside the
 * roster data, like the HCRIS cost-report JSON -- a recorded Medicare enrollment ownership
 * transfer, not by itself a confirmed property sale). Lazy and cached at module level: only the
 * Ownership tab needs it. Returns null when the file is missing or fails to load -- the CHOW
 * card then says so rather than implying "no transfers on record".
 */
export function loadChowData(): Promise<ChowData | null> {
  cached ??= (async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/chow.json`)
      if (!res.ok) return null
      return (await res.json()) as ChowData
    } catch {
      return null
    }
  })()
  return cached
}
