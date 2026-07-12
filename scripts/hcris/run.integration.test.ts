import { execFile } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { processFiscalYear } from './run.js'

const execFileAsync = promisify(execFile)

/**
 * End-to-end test of the real pipeline mechanics (HTTP download -> unzip -> parse RPT ->
 * stream-parse NMRC -> validate/derive) against a synthetic zip built to match the documented
 * HCRIS format, served over a real local HTTP server. This is the strongest verification possible
 * without live cms.gov access -- it exercises every moving part except the actual scrape of the
 * real CMS page (covered separately in scrape.test.ts) and whether the real CMS zip's internal
 * format matches what's assumed here.
 */

const RPT_CSV = [
  ['2001', '1', '145001', '', '1', '01/01/2025', '12/31/2025', '06/01/2026', 'Y', 'Y'].join(','),
  ['2002', '1', '145002', '', '3', '01/01/2025', '12/31/2025', '05/15/2026', 'Y', 'Y'].join(',')
].join('\n')

const NMRC_CSV = [
  // Facility 145001 (rpt 2001) -- entirely clean.
  // Column 5 (00500) = medicaid, column 6 (00600) = medicare -- see metricCatalog.ts's comment on
  // why these two were previously swapped.
  '2001,S300001,00100,00100,120',
  '2001,S300001,00100,00200,43800',
  '2001,S300001,00100,00700,30000',
  '2001,S300001,00100,00500,18000',
  '2001,S300001,00100,00600,9000',
  '2001,G300000,00300,00100,20000000',
  '2001,G300000,00400,00100,18000000',
  '2001,G300000,00100,00100,17500000',
  // Facility 145002 (rpt 2002) -- medicarePatientDays deliberately absurd (a mis-mapped cell should
  // never silently pass through as real data).
  '2002,S300001,00100,00100,80',
  '2002,S300001,00100,00200,29200',
  '2002,S300001,00100,00700,25000',
  '2002,S300001,00100,00500,10000',
  '2002,S300001,00100,00600,99999999',
  '2002,G300000,00300,00100,10000000',
  '2002,G300000,00400,00100,9000000',
  '2002,G300000,00100,00100,8800000'
].join('\n')

let server: Server
let baseUrl: string
let sourceDir: string
let workDir: string

beforeAll(async () => {
  sourceDir = await mkdtemp(path.join(tmpdir(), 'hcris-src-'))
  await writeFile(path.join(sourceDir, 'SNF10_2025_RPT.CSV'), RPT_CSV, 'utf8')
  await writeFile(path.join(sourceDir, 'SNF10_2025_NMRC.CSV'), NMRC_CSV, 'utf8')
  await writeFile(path.join(sourceDir, 'SNF10_2025_ALPHNMRC.CSV'), '', 'utf8')

  const zipPath = path.join(sourceDir, 'SNF10FY2025.zip')
  await execFileAsync('zip', ['-j', '-q', zipPath, path.join(sourceDir, 'SNF10_2025_RPT.CSV'), path.join(sourceDir, 'SNF10_2025_NMRC.CSV'), path.join(sourceDir, 'SNF10_2025_ALPHNMRC.CSV')])

  server = createServer(async (_req, res) => {
    const { readFile } = await import('node:fs/promises')
    const data = await readFile(zipPath)
    res.writeHead(200, { 'Content-Type': 'application/zip' })
    res.end(data)
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  baseUrl = `http://127.0.0.1:${port}`

  workDir = await mkdtemp(path.join(tmpdir(), 'hcris-work-'))
  await mkdir(workDir, { recursive: true })
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await rm(sourceDir, { recursive: true, force: true })
  await rm(workDir, { recursive: true, force: true })
})

describe('processFiscalYear (integration)', () => {
  it('downloads, extracts, parses, and validates a real zip end to end', async () => {
    const { records, warnings } = await processFiscalYear(2025, `${baseUrl}/SNF10FY2025.zip`, workDir)

    expect(records).toHaveLength(2)

    const clean = records.find((r) => r.ccn === '145001')!
    expect(clean.bedsAvailable).toBe(120)
    expect(clean.occupancyPct).toBeCloseTo((30000 / 43800) * 100, 1)
    expect(clean.medicarePct).toBeCloseTo((9000 / 30000) * 100, 1)
    expect(clean.medicaidPct).toBeCloseTo((18000 / 30000) * 100, 1)
    // Net income is derived (totalPatientRevenue - totalOperatingExpenses): 20,000,000 - 17,500,000.
    expect(clean.netIncome).toBe(2_500_000)
    expect(clean.operatingMarginPct).toBeCloseTo((2_500_000 / 20_000_000) * 100, 1)
    expect(clean.reportStatusLabel).toBe('As submitted')

    const bad = records.find((r) => r.ccn === '145002')!
    expect(bad.medicarePct).toBeNull() // the absurd medicare value must not survive
    expect(bad.medicaidPct).not.toBeNull() // an unrelated good field on the same report isn't collateral damage
    expect(bad.reportStatusLabel).toBe('Settled with audit')

    expect(warnings.some((w) => w.includes('145002') && w.includes('medicarePatientDays'))).toBe(true)
  })
})
