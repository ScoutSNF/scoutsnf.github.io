import { describe, expect, it } from 'vitest'
import { groupByCcn, upsertRecords } from './upsert.js'
import type { FacilityYearRecord } from './types.js'

function rec(overrides: Partial<FacilityYearRecord> = {}): FacilityYearRecord {
  return {
    ccn: '145678',
    fyBeginDate: '2025-01-01',
    fyEndDate: '2025-12-31',
    reportStatus: 1,
    reportStatusLabel: 'As submitted',
    processDate: '2026-06-01',
    bedsAvailable: 100,
    totalPatientDays: 29200,
    medicarePatientDays: null,
    medicaidPatientDays: null,
    otherPatientDays: null,
    occupancyPct: 80,
    medicarePct: null,
    medicaidPct: null,
    otherPct: null,
    totalPatientRevenue: null,
    netPatientRevenue: null,
    totalOperatingExpenses: null,
    netIncome: null,
    operatingMarginPct: null,
    ...overrides
  }
}

describe('upsertRecords', () => {
  it('keeps a single record per (ccn, fyBeginDate) even with duplicate input', () => {
    const merged = upsertRecords([], [rec(), rec()])
    expect(merged).toHaveLength(1)
  })

  it('prefers the higher report status code on collision', () => {
    const older = rec({ reportStatus: 1, processDate: '2026-01-01', occupancyPct: 79 })
    const newer = rec({ reportStatus: 2, processDate: '2026-01-01', occupancyPct: 81 })
    const merged = upsertRecords([older], [newer])
    expect(merged).toHaveLength(1)
    expect(merged[0].reportStatus).toBe(2)
    expect(merged[0].occupancyPct).toBe(81)
  })

  it('never regresses to a lower report status even if it arrives later', () => {
    const settled = rec({ reportStatus: 3, processDate: '2026-01-01' })
    const staleResubmit = rec({ reportStatus: 1, processDate: '2026-06-01' })
    const merged = upsertRecords([settled], [staleResubmit])
    expect(merged[0].reportStatus).toBe(3)
  })

  it('tiebreaks on newer process date when status is equal', () => {
    const first = rec({ reportStatus: 1, processDate: '2026-01-01' })
    const later = rec({ reportStatus: 1, processDate: '2026-06-01', occupancyPct: 82 })
    const merged = upsertRecords([first], [later])
    expect(merged[0].processDate).toBe('2026-06-01')
    expect(merged[0].occupancyPct).toBe(82)
  })

  it('keeps distinct fiscal years for the same facility separate', () => {
    const fy24 = rec({ fyBeginDate: '2024-01-01', fyEndDate: '2024-12-31' })
    const fy25 = rec({ fyBeginDate: '2025-01-01', fyEndDate: '2025-12-31' })
    const merged = upsertRecords([], [fy24, fy25])
    expect(merged).toHaveLength(2)
  })
})

describe('groupByCcn', () => {
  it('groups and sorts each facility years ascending', () => {
    const fy25 = rec({ fyBeginDate: '2025-01-01' })
    const fy23 = rec({ fyBeginDate: '2023-01-01' })
    const other = rec({ ccn: '999999', fyBeginDate: '2024-01-01' })
    const grouped = groupByCcn([fy25, fy23, other])
    expect(Object.keys(grouped).sort()).toEqual(['145678', '999999'])
    expect(grouped['145678'].map((r) => r.fyBeginDate)).toEqual(['2023-01-01', '2025-01-01'])
  })
})
