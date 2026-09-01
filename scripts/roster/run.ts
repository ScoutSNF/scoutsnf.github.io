import { writeFile, readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type { SnfRecord, HospitalRecord } from './types.js'
import { fetchSnfRecords } from './fetchSnfRoster.js'
import { fetchHospitalRecords } from './fetchHospitalRoster.js'
import { fetchHospitalBedCounts } from './fetchBedCounts.js'
import { loadGeocodeCache, saveGeocodeCache, resolveCoordinatesWithCache, type GeocodeCache } from './geocodeCache.js'
import { fixCoordinateCollisions } from './fixCollisions.js'
import { validateRoster, type RosterManifestCounts } from './validate.js'
import { CMS_SNF_DATASET_ID, CMS_HOSPITAL_DATASET_ID, CMS_POS_HOSPITAL_DATASET_UUID } from './sources.js'
import type { GeocodeInput } from './geocode.js'

const DATA_DIR = path.resolve('public/data')
const SNF_OUTPUT_PATH = path.join(DATA_DIR, 'snf-roster.json')
const HOSPITAL_OUTPUT_PATH = path.join(DATA_DIR, 'hospital-roster.json')
const MANIFEST_PATH = path.join(DATA_DIR, 'roster-manifest.json')

interface RosterManifest {
  built_at: string
  snf: { count: number; source_dataset_id: string }
  hospital: {
    count: number
    source_dataset_id: string
    source_bed_dataset_id: string
    /** Kept distinct from the roster/geocoding status above -- a bed-count-fetch problem
     * shouldn't be lumped in with (or block publishing) the roster itself. */
    bedCounts: { matched: number; total: number; error: string | null }
  }
}

async function readPreviousManifest(): Promise<RosterManifestCounts | undefined> {
  try {
    const text = await readFile(MANIFEST_PATH, 'utf8')
    const manifest = JSON.parse(text) as RosterManifest
    return { snfCount: manifest.snf.count, hospitalCount: manifest.hospital.count }
  } catch {
    return undefined
  }
}

async function geocodeHospitals(hospitals: HospitalRecord[], cache: GeocodeCache): Promise<void> {
  const inputs: GeocodeInput[] = hospitals.map((h) => ({ id: h.ccn, address: h.address, city: h.city, state: h.state, zip: h.zip }))
  console.log(`Geocoding ${inputs.length} hospital(s) (cache-first)...`)
  const geocoded = await resolveCoordinatesWithCache(inputs, cache, (stage, done, total) => {
    if (done === 0 || done === total || done % 500 === 0) console.log(`  ${stage}: ${done}/${total}`)
  })
  const byCcn = new Map(hospitals.map((h) => [h.ccn, h]))
  for (const [ccn, geo] of geocoded) {
    const h = byCcn.get(ccn)
    if (h) {
      h.latitude = geo.latitude
      h.longitude = geo.longitude
    }
  }
  const stillMissing = hospitals.filter((h) => h.latitude == null || h.longitude == null).length
  console.log(`Geocoding done: ${hospitals.length - stillMissing}/${hospitals.length} resolved (${stillMissing} unresolved)`)
}

export async function run(): Promise<void> {
  const previousCounts = await readPreviousManifest()
  const cache = await loadGeocodeCache()

  console.log('Fetching SNF roster...')
  const snfs: SnfRecord[] = await fetchSnfRecords((attempt, attempts) => console.log(`  SNF roster fetch retry ${attempt}/${attempts}`))
  console.log(`SNF roster: ${snfs.length} record(s)`)

  console.log('Fetching hospital roster...')
  const hospitals: HospitalRecord[] = await fetchHospitalRecords((attempt, attempts) => console.log(`  Hospital roster fetch retry ${attempt}/${attempts}`))
  console.log(`Hospital roster: ${hospitals.length} record(s)`)

  await geocodeHospitals(hospitals, cache)

  // Bed counts come from a third, independent CMS dataset (Provider of Services) -- a failure
  // here shouldn't block publishing the roster/coordinates, which is the P0-relevant data. Matches
  // the original spec's own guidance: isolate a failed source with a degraded status rather than
  // either publishing a silent mix or discarding an otherwise-good build.
  console.log('Fetching hospital bed counts...')
  let bedCounts: RosterManifest['hospital']['bedCounts']
  try {
    const beds = await fetchHospitalBedCounts()
    let matched = 0
    for (const h of hospitals) {
      const bedCount = beds.get(h.ccn)
      if (bedCount != null) {
        h.certifiedBeds = bedCount
        matched++
      }
    }
    bedCounts = { matched, total: hospitals.length, error: null }
    console.log(`Bed counts matched: ${matched}/${hospitals.length}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    bedCounts = { matched: 0, total: hospitals.length, error: message }
    console.warn(`Bed count fetch failed, publishing without bed counts this run: ${message}`)
  }

  console.log('Checking for SNF coordinate collisions...')
  const collisionCount = await fixCoordinateCollisions(snfs, cache)
  console.log(`Coordinate collisions fixed: ${collisionCount}`)

  const issues = validateRoster(snfs, hospitals, previousCounts)
  if (issues.length > 0) {
    console.error('Validation failed -- aborting without publishing:')
    for (const issue of issues) console.error(`  - ${issue}`)
    throw new Error(`Roster validation failed with ${issues.length} issue(s); see log above`)
  }

  const manifest: RosterManifest = {
    built_at: new Date().toISOString(),
    snf: { count: snfs.length, source_dataset_id: CMS_SNF_DATASET_ID },
    hospital: {
      count: hospitals.length,
      source_dataset_id: CMS_HOSPITAL_DATASET_ID,
      source_bed_dataset_id: CMS_POS_HOSPITAL_DATASET_UUID,
      bedCounts
    }
  }

  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(SNF_OUTPUT_PATH, JSON.stringify(snfs), 'utf8')
  await writeFile(HOSPITAL_OUTPUT_PATH, JSON.stringify(hospitals), 'utf8')
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  await saveGeocodeCache(cache)

  console.log('\n=== Summary ===')
  console.log(`SNFs: ${snfs.length}`)
  console.log(`Hospitals: ${hospitals.length}`)
  console.log(`Coordinate collisions fixed: ${collisionCount}`)
  console.log(`Wrote ${SNF_OUTPUT_PATH}`)
  console.log(`Wrote ${HOSPITAL_OUTPUT_PATH}`)
  console.log(`Wrote ${MANIFEST_PATH}`)
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  run().catch((err) => {
    console.error('Roster pipeline failed:', err)
    process.exitCode = 1
  })
}
