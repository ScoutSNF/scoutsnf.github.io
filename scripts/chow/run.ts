import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseCsv } from '../roster/csv.js'
import { fetchWithRetry } from '../roster/fetchRetry.js'

/**
 * Builds public/data/chow.json from CMS's PECOS SNF change-of-ownership (CHOW) file.
 *
 * The file is a dated release linked from CMS's nursing-home ownership pages rather than a
 * dataset in the provider-data catalog, so there is no metastore entry to resolve -- the URL is
 * hardcoded and must be updated when CMS publishes a new release. The release date and the
 * effective-date coverage window are recorded in the output so the UI can cite exactly what a
 * "no entry" answer is drawn from: a CHOW is a recorded Medicare enrollment ownership transfer,
 * not by itself a confirmed property sale, and CMS notes the file covers most, not all,
 * transfers in the window.
 */
const CHOW_CSV_URL = 'https://data.cms.gov/sites/default/files/2026-10/89166aa5-0fb8-49d6-bef5-f970876794b5/SNF_CHOW_2026.09.29.csv'
const RELEASE_DATE = '2026-09-29'

const OUTPUT_PATH = path.resolve('public/data/chow.json')

interface ChowEntry {
  effectiveDate: string
  buyerOrg: string
  buyerDba: string
  sellerOrg: string
  sellerDba: string
  chowType: string
}

function parseUsDate(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim())
  if (!m) return null
  return `${m[3]}-${m[1]}-${m[2]}`
}

export async function run(): Promise<void> {
  const res = await fetchWithRetry(CHOW_CSV_URL, 'SNF CHOW file', undefined, { attempts: 3 })
  const text = await res.text()
  const rows = parseCsv(text)
  const headers = rows[0].map((h) => h.replace(/^"|"$/g, ''))
  const col = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase())

  const ccnCol = col('CCN - BUYER')
  const effCol = col('EFFECTIVE DATE')
  const typeCol = col('CHOW TYPE TEXT')
  const buyerOrgCol = col('ORGANIZATION NAME - BUYER')
  const buyerDbaCol = col('DOING BUSINESS AS NAME - BUYER')
  const sellerOrgCol = col('ORGANIZATION NAME - SELLER')
  const sellerDbaCol = col('DOING BUSINESS AS NAME - SELLER')
  if (ccnCol === -1 || effCol === -1) throw new Error(`CHOW file headers changed -- got: ${headers.join(', ')}`)

  const entries: Record<string, ChowEntry[]> = {}
  const dates: string[] = []
  for (const row of rows.slice(1)) {
    const ccn = row[ccnCol]?.trim()
    const iso = parseUsDate(row[effCol] ?? '')
    if (!ccn || !iso) continue
    dates.push(iso)
    ;(entries[ccn] ??= []).push({
      effectiveDate: iso,
      buyerOrg: row[buyerOrgCol]?.trim() ?? '',
      buyerDba: row[buyerDbaCol]?.trim() ?? '',
      sellerOrg: row[sellerOrgCol]?.trim() ?? '',
      sellerDba: row[sellerDbaCol]?.trim() ?? '',
      chowType: row[typeCol]?.trim() ?? ''
    })
  }
  for (const list of Object.values(entries)) list.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
  dates.sort()

  const output = {
    releaseDate: RELEASE_DATE,
    sourceUrl: CHOW_CSV_URL,
    coverageStart: dates[0],
    coverageEnd: dates[dates.length - 1],
    transferCount: dates.length,
    entries
  }
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(output), 'utf8')
  console.log(`CHOW: ${dates.length} transfers across ${Object.keys(entries).length} CCNs, ${dates[0]} .. ${dates[dates.length - 1]}`)
  console.log(`Wrote ${OUTPUT_PATH}`)
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  run().catch((err) => {
    console.error('CHOW build failed:', err)
    process.exitCode = 1
  })
    }
