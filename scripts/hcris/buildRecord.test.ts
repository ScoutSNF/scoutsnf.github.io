import { describe, expect, it } from 'vitest'
import { buildFacilityYearRecord } from './buildRecord.js'
import type { RptRow } from './types.js'

function rpt(overrides: Partial<RptRow> = {}): RptRow {
  return {
    rptRecNum: '1001',
    prvdrNum: '145678',
    fyBeginDate: '2025-01-01',
    fyEndDate: '2025-12-31',
    rptStatusCode: 1,
    processDate: '2026-06-01',
    ...overrides
  }
}

describe('buildFacilityYearRecord', () => {
  it('computes occupancy, payer mix, and margin from clean inputs', () => {
    const { record, warnings } = buildFacilityYearRecord(rpt(), {
      bedsAvailable: 100,
      bedDaysAvailable: 36500,
      totalPatientDays: 29200,
      medicarePatientDays: 7008,
      medicaidPatientDays: 18688,
      totalPatientRevenue: 15_000_000,
      netPatientRevenue: 13_500_000,
      totalOperatingExpenses: 13_680_000
    })

    expect(warnings).toEqual([])
    expect(record).not.toBeNull()
    expect(record!.occupancyPct).toBe(80)
    expect(record!.medicarePct).toBe(24)
    expect(record!.medicaidPct).toBe(64)
    expect(record!.otherPct).toBe(12)
    expect(record!.otherPatientDays).toBe(29200 - 7008 - 18688)
    // Net income is derived (totalPatientRevenue - totalOperatingExpenses), not read from its own cell.
    expect(record!.netIncome).toBe(15_000_000 - 13_680_000)
    expect(record!.operatingMarginPct).toBeCloseTo(((15_000_000 - 13_680_000) / 15_000_000) * 100, 1)
    expect(record!.reportStatusLabel).toBe('As submitted')
  })

  it('drops the whole record when a required metric is missing', () => {
    const { record, warnings } = buildFacilityYearRecord(rpt(), { bedsAvailable: 100 })
    expect(record).toBeNull()
    expect(warnings.some((w) => w.includes('totalPatientDays'))).toBe(true)
  })

  it('drops (not silently trusts) a beds value outside the plausible range', () => {
    const { record, warnings } = buildFacilityYearRecord(rpt(), {
      bedsAvailable: 999_999, // clearly a mis-mapped cell, not a real bed count
      totalPatientDays: 29200
    })
    expect(record).toBeNull() // bedsAvailable is required
    expect(warnings.some((w) => w.includes('bedsAvailable') && w.includes('outside plausible range'))).toBe(true)
  })

  it('drops payer mix when medicare+medicaid days exceed total days (bad cell reference)', () => {
    const { record, warnings } = buildFacilityYearRecord(rpt(), {
      bedsAvailable: 100,
      totalPatientDays: 10000,
      medicarePatientDays: 8000,
      medicaidPatientDays: 8000 // sum (16000) > total (10000): impossible, should be dropped
    })
    expect(record).not.toBeNull()
    expect(record!.medicarePct).toBeNull()
    expect(record!.medicaidPct).toBeNull()
    expect(record!.otherPatientDays).toBeNull()
    expect(warnings.some((w) => w.includes('exceed total days'))).toBe(true)
  })

  it('drops totalPatientDays-vs-bedDaysAvailable inconsistency without failing the whole record', () => {
    const { record, warnings } = buildFacilityYearRecord(rpt(), {
      bedsAvailable: 100,
      bedDaysAvailable: 1000, // way too low for a full year -- mis-mapped cell
      totalPatientDays: 29200
    })
    expect(record).not.toBeNull()
    expect(record!.occupancyPct).toBeNull() // can't compute without a trustworthy bedDaysAvailable
    expect(record!.totalPatientDays).toBe(29200) // the required metric itself is untouched
    expect(warnings.some((w) => w.includes('bedDaysAvailable'))).toBe(true)
  })

  it('leaves net income null when either input to the derivation is missing', () => {
    const { record } = buildFacilityYearRecord(rpt(), {
      bedsAvailable: 100,
      totalPatientDays: 29200,
      totalOperatingExpenses: 1_000_000
      // totalPatientRevenue never extracted for this report
    })
    expect(record).not.toBeNull()
    expect(record!.netIncome).toBeNull()
    expect(record!.operatingMarginPct).toBeNull()
  })

  it('leaves financial fields null (not zero) when never extracted', () => {
    const { record } = buildFacilityYearRecord(rpt(), { bedsAvailable: 100, totalPatientDays: 29200 })
    expect(record!.totalPatientRevenue).toBeNull()
    expect(record!.netIncome).toBeNull()
    expect(record!.operatingMarginPct).toBeNull()
  })
})
