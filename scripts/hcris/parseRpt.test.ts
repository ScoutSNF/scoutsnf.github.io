import { describe, expect, it } from 'vitest'
import { normalizeHcrisDate, parseRpt } from './parseRpt.js'

// Column order: rpt_rec_num, prvdr_ctrl_type_cd, prvdr_num, npi, rpt_stus_cd, fy_bgn_dt, fy_end_dt, proc_dt, ...trailing fields
function rptLine(fields: Partial<{ rptRecNum: string; prvdrNum: string; stus: string; bgn: string; end: string; proc: string }>): string {
  const {
    rptRecNum = '1001',
    prvdrNum = '145678',
    stus = '1',
    bgn = '01/01/2025',
    end = '12/31/2025',
    proc = '06/01/2026'
  } = fields
  return [rptRecNum, '1', prvdrNum, '', stus, bgn, end, proc, 'Y', 'Y', '', '', '', '', '', '', '', ''].join(',')
}

describe('normalizeHcrisDate', () => {
  it('converts MM/DD/YYYY to ISO', () => {
    expect(normalizeHcrisDate('01/05/2025')).toBe('2025-01-05')
  })
  it('passes through an already-ISO date', () => {
    expect(normalizeHcrisDate('2025-01-05')).toBe('2025-01-05')
  })
  it('returns null for empty/garbage input', () => {
    expect(normalizeHcrisDate('')).toBeNull()
    expect(normalizeHcrisDate(undefined)).toBeNull()
    expect(normalizeHcrisDate('not a date')).toBeNull()
  })
})

describe('parseRpt', () => {
  it('parses a well-formed headerless RPT file', () => {
    const text = [rptLine({}), rptLine({ rptRecNum: '1002', prvdrNum: '145679', stus: '3' })].join('\n')
    const { rows, skipped } = parseRpt(text)
    expect(skipped).toBe(0)
    expect(rows.size).toBe(2)
    const r1 = rows.get('1001')!
    expect(r1.prvdrNum).toBe('145678')
    expect(r1.fyBeginDate).toBe('2025-01-01')
    expect(r1.fyEndDate).toBe('2025-12-31')
    expect(r1.rptStatusCode).toBe(1)
    expect(r1.processDate).toBe('2026-06-01')
  })

  it('skips rows with an out-of-range status code without throwing', () => {
    const text = rptLine({ stus: '9' })
    const { rows, skipped } = parseRpt(text)
    expect(rows.size).toBe(0)
    expect(skipped).toBe(1)
  })

  it('skips rows where fy_end_dt is not after fy_bgn_dt', () => {
    const text = rptLine({ bgn: '12/31/2025', end: '01/01/2025' })
    const { rows, skipped } = parseRpt(text)
    expect(rows.size).toBe(0)
    expect(skipped).toBe(1)
  })

  it('skips rows missing a provider number', () => {
    const text = rptLine({ prvdrNum: '' })
    const { rows, skipped } = parseRpt(text)
    expect(rows.size).toBe(0)
    expect(skipped).toBe(1)
  })
})
