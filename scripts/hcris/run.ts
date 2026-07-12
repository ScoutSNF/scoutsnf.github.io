import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { findRecentSnfZipLinks } from './scrape.js'
import { downloadToFile, extractZip, findExtractedFile } from './download.js'
import { parseRpt } from './parseRpt.js'
import { parseNmrcStream } from './parseNmrc.js'
import { buildFacilityYearRecord } from './buildRecord.js'
import { upsertRecords, groupByCcn } from './upsert.js'
import { METRIC_CATALOG } from './metricCatalog.js'
import type { FacilityYearRecord } from './types.js'

const FY_WINDOW = 3
const OUTPUT_PATH = path.resolve('public/data/hcris-cost-reports.json')

export async function processFiscalYear(fy: number, zipUrl: string, workDir: string): Promise<{ records: FacilityYearRecord[]; warnings: string[] }> {
  console.log(`\n=== FY${fy}: ${zipUrl} ===`)
  const zipPath = path.join(workDir, `SNF-FY${fy}.zip`)
  const extractDir = path.join(workDir, `FY${fy}`)

  await downloadToFile(zipUrl, zipPath)
  const files = await extractZip(zipPath, extractDir)
  console.log(`FY${fy}: extracted ${files.length} file(s): ${files.join(', ')}`)

  const rptFile = findExtractedFile(files, '_RPT.CSV') ?? findExtractedFile(files, 'RPT.CSV')
  const nmrcFile = findExtractedFile(files, '_NMRC.CSV') ?? findExtractedFile(files, 'NMRC.CSV')
  if (!rptFile || !nmrcFile) {
    throw new Error(`FY${fy}: could not find RPT/NMRC files among: ${files.join(', ')}`)
  }

  const rptText = await readFile(path.join(extractDir, rptFile), 'utf8')
  const { rows: rptRows, skipped: rptSkipped } = parseRpt(rptText)
  console.log(`FY${fy}: parsed ${rptRows.size} report(s) from RPT file (${rptSkipped} skipped as malformed)`)

  const metricValues = await parseNmrcStream(path.join(extractDir, nmrcFile), METRIC_CATALOG)
  console.log(`FY${fy}: matched NMRC cells for ${metricValues.size} report(s)`)

  const records: FacilityYearRecord[] = []
  const warnings: string[] = []
  for (const rpt of rptRows.values()) {
    const raw = metricValues.get(rpt.rptRecNum) ?? {}
    const { record, warnings: recordWarnings } = buildFacilityYearRecord(rpt, raw)
    warnings.push(...recordWarnings)
    if (record) records.push(record)
  }
  console.log(`FY${fy}: ${records.length} valid facility-year record(s), ${warnings.length} warning(s)`)

  return { records, warnings }
}

export async function run(): Promise<void> {
  const targets = await findRecentSnfZipLinks(FY_WINDOW)
  console.log(`Selected ${targets.length} fiscal year(s): ${targets.map((t) => t.fiscalYear).join(', ')}`)

  const workDir = await mkdtemp(path.join(tmpdir(), 'hcris-'))
  let merged: FacilityYearRecord[] = []
  const allWarnings: string[] = []
  const fyCounts: Record<number, number> = {}

  try {
    for (const target of targets) {
      const { records, warnings } = await processFiscalYear(target.fiscalYear, target.url, workDir)
      fyCounts[target.fiscalYear] = records.length
      allWarnings.push(...warnings)
      merged = upsertRecords(merged, records)
    }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }

  if (merged.length === 0) {
    throw new Error('Pipeline produced zero valid facility-year records across all fiscal years -- aborting without writing output.')
  }

  const output = {
    generatedAt: new Date().toISOString(),
    fiscalYearsIncluded: targets.map((t) => t.fiscalYear).sort(),
    records: groupByCcn(merged)
  }

  await mkdirForFile(OUTPUT_PATH)
  await writeFile(OUTPUT_PATH, JSON.stringify(output), 'utf8')

  console.log(`\n=== Summary ===`)
  for (const [fy, count] of Object.entries(fyCounts)) console.log(`FY${fy}: ${count} record(s) processed`)
  console.log(`Total facilities: ${Object.keys(output.records).length}`)
  console.log(`Total facility-year records after dedup: ${merged.length}`)
  console.log(`Warnings: ${allWarnings.length}`)
  if (allWarnings.length > 0) {
    console.log(`First 20 warnings:`)
    for (const w of allWarnings.slice(0, 20)) console.log(`  - ${w}`)
  }
  console.log(`Wrote ${OUTPUT_PATH}`)
}

async function mkdirForFile(filePath: string): Promise<void> {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(path.dirname(filePath), { recursive: true })
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  run().catch((err) => {
    console.error('HCRIS pipeline failed:', err)
    process.exitCode = 1
  })
}
