import type { SnfRecord, HospitalRecord } from './types.js'

// CMS certifies facilities across US territories scattered clear around the globe -- a single
// contiguous lat/lon box can't cover the mainland+AK+HI+PR/USVI cluster (roughly -180 to -65) AND
// Guam/Northern Mariana Islands (~+144 to +147, the *other* side of the antimeridian) AND American
// Samoa (~-172 to -168, southern hemisphere) without also swallowing most of the globe in between.
// So this validates against a set of known-valid regions instead: a coordinate is fine if it falls
// in *any* of them. Confirmed against real data -- CCN 655000 "Guam Memorial Hospital Authority"
// at (13.4886, 144.797) failed the original single mainland-shaped box and correctly blocked
// publication, which is how this list got the Guam/CNMI region added.
const VALID_REGIONS: Array<{ name: string; lat: [number, number]; lon: [number, number] }> = [
  { name: 'mainland US + AK/HI/PR/USVI', lat: [15, 72], lon: [-180, -65] },
  { name: 'Guam / Northern Mariana Islands', lat: [13, 21], lon: [144, 147] },
  { name: 'American Samoa', lat: [-15, -13], lon: [-172, -168] }
]

// A single bad CI run publishing a roster with most of the country missing would be far worse
// than the CI run failing loudly -- 15% is a large enough drop that it can't plausibly be normal
// month-to-month churn in CMS's own data.
const MAX_COUNT_DROP_FRACTION = 0.15

export interface RosterManifestCounts {
  snfCount: number
  hospitalCount: number
}

function inUsBounds(lat: number, lon: number): boolean {
  return VALID_REGIONS.some((r) => lat >= r.lat[0] && lat <= r.lat[1] && lon >= r.lon[0] && lon <= r.lon[1])
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
