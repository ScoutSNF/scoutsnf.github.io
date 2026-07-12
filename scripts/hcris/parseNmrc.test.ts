import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseNmrcStream } from './parseNmrc.js'
import type { MetricDef } from './types.js'

const METRICS: MetricDef[] = [
  { key: 'bedsAvailable', wkshtCd: 'S300001', lineNum: '00100', clmnNum: '00200' },
  { key: 'totalPatientDays', wkshtCd: 'S300001', lineNum: '00800', clmnNum: '00700' }
]

describe('parseNmrcStream', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'nmrc-test-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('keeps only rows matching a wanted cell and ignores the rest', async () => {
    const file = path.join(dir, 'FY2025_NMRC.CSV')
    const lines = [
      '1001,S300001,00100,00200,100', // wanted: bedsAvailable
      '1001,S300001,00800,00700,29200', // wanted: totalPatientDays
      '1001,S300001,09999,09999,555', // not wanted -- must be ignored
      '1002,S300001,00100,00200,80' // different report
    ]
    await writeFile(file, lines.join('\n'), 'utf8')

    const result = await parseNmrcStream(file, METRICS)
    expect(result.get('1001')).toEqual({ bedsAvailable: 100, totalPatientDays: 29200 })
    expect(result.get('1002')).toEqual({ bedsAvailable: 80 })
  })

  it('skips rows with a non-numeric value instead of crashing', async () => {
    const file = path.join(dir, 'FY2025_NMRC.CSV')
    await writeFile(file, '1001,S300001,00100,00200,NOT_A_NUMBER', 'utf8')
    const result = await parseNmrcStream(file, METRICS)
    expect(result.has('1001')).toBe(false)
  })

  it('handles an empty file without error', async () => {
    const file = path.join(dir, 'FY2025_NMRC.CSV')
    await writeFile(file, '', 'utf8')
    const result = await parseNmrcStream(file, METRICS)
    expect(result.size).toBe(0)
  })
})
