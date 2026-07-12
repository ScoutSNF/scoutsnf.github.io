import type { FacilityYearRecord, HcrisOutput } from '../types/costReport'

/**
 * Fetches the static HCRIS cost-report artifact produced by scripts/hcris/run.ts (built and
 * committed by the quarterly GitHub Action, not fetched live from CMS). Same-origin static file --
 * no CORS proxy, no retry storm needed. Returns an empty map if the file doesn't exist yet (before
 * the pipeline's first real run) or fails to load -- cost report data is a supplementary layer, not
 * required for the app to function.
 */
export async function loadCostReports(): Promise<Map<string, FacilityYearRecord[]>> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/hcris-cost-reports.json`)
    if (!res.ok) return new Map()
    const json = (await res.json()) as HcrisOutput
    return new Map(Object.entries(json.records ?? {}))
  } catch {
    return new Map()
  }
}
