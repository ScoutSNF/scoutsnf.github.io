import type { SnfRecord, HospitalRecord } from './types.js'

// Generous continental-US-plus-territories bounding box (covers AK, HI, PR) -- wide enough to
// never false-positive on a real US facility, tight enough to catch a badly parsed/garbage
// coordinate (e.g. 0,0 or a swapped lat/lon).
const US_LAT_RANGE: [number, number] = [15, 72]
const US_LON_RANGE: [number, number] = [-180, -60]

// A single bad CI run publishing a roster with most of the country missing would be far worse
// than the CI run failing loudly -- 15% is a large enough drop that it can't plausibly be normal
// month-to-month churn in CMS's own data.
const MAX_COUNT_DROP_FRACTION = 0.15

export interface RosterManifestCounts {
  snfCount: number
  hospitalCount: number
}

function inUsBounds(lat: number, lon: number): boolean {
  return lat >= US_LAT_RANGE[0] && lat <= US_LAT_RANGE[1] && lon >= US_LON_RANGE[0] && lon <= US_LON_RANGE[1]
}

function findDuplicateCcns(records: Array<{ ccn: string }>): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const r of records) {
    if (seen.has(r.ccn)) dupes.add(r.ccn)
    seen.add(r.ccn)
  }
  return [...dupes]
}

function checkCountDrop(label: string, current: number, previous: number | undefined, issues: string[]): void {
  if (previous == null || previous === 0) return
  const drop = (previous - current) / previous
  if (drop > MAX_COUNT_DROP_FRACTION) {
    issues.push(`${label} count dropped ${(drop * 100).toFixed(1)}% (${previous} -> ${current}), exceeding the ${MAX_COUNT_DROP_FRACTION * 100}% threshold`)
  }
}

/**
 * Returns a list of human-readable problems; an empty array means the roster is safe to publish.
 * Never overwrites a good published roster with a broken one -- the caller aborts the whole run
 * (no files written) if this returns anything.
 */
export function validateRoster(snfs: SnfRecord[], hospitals: HospitalRecord[], previous?: RosterManifestCounts): string[] {
  const issues: string[] = []

  if (snfs.length === 0) issues.push('SNF roster is empty')
  if (hospitals.length === 0) issues.push('Hospital roster is empty')

  const dupeSnfCcns = findDuplicateCcns(snfs)
  if (dupeSnfCcns.length > 0) issues.push(`${dupeSnfCcns.length} duplicate SNF CCN(s): ${dupeSnfCcns.slice(0, 10).join(', ')}`)
  const dupeHospitalCcns = findDuplicateCcns(hospitals)
  if (dupeHospitalCcns.length > 0) issues.push(`${dupeHospitalCcns.length} duplicate hospital CCN(s): ${dupeHospitalCcns.slice(0, 10).join(', ')}`)

  const badSnfCoords = snfs.filter((r) => r.latitude != null && r.longitude != null && !inUsBounds(r.latitude, r.longitude))
  if (badSnfCoords.length > 0) {
    const b = badSnfCoords[0]
    issues.push(
      `${badSnfCoords.length} SNF(s) with out-of-bounds coordinates, e.g. CCN ${b.ccn} "${b.name}" in ${b.city}, ${b.state} ${b.zip} at (${b.latitude}, ${b.longitude}), address="${b.address}"`
    )
  }
  const badHospitalCoords = hospitals.filter((r) => r.latitude != null && r.longitude != null && !inUsBounds(r.latitude, r.longitude))
  if (badHospitalCoords.length > 0) {
    const b = badHospitalCoords[0]
    issues.push(
      `${badHospitalCoords.length} hospital(s) with out-of-bounds coordinates, e.g. CCN ${b.ccn} "${b.name}" in ${b.city}, ${b.state} ${b.zip} at (${b.latitude}, ${b.longitude}), address="${b.address}"`
    )
  }

  checkCountDrop('SNF', snfs.length, previous?.snfCount, issues)
  checkCountDrop('Hospital', hospitals.length, previous?.hospitalCount, issues)

  return issues
}
