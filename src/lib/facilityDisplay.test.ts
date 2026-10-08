import { describe, expect, it } from 'vitest'
import { parseDateOnly, formatDate, titleCaseName, getCmsAsOf } from './facilityDisplay'
import type { SnfRecord, HospitalRecord } from '../types/facility'

describe('parseDateOnly', () => {
  // `new Date('2024-12-31')` is specified to parse as UTC midnight, which reads back as the 30th
  // anywhere west of UTC. Every wall-clock date in the app (fiscal year ends, CMS processing
  // dates) has to survive that.
  it('keeps a date-only string on its own calendar day', () => {
    const d = parseDateOnly('2024-12-31')
    expect(d.getFullYear()).toBe(2024)
    expect(d.getMonth()).toBe(11)
    expect(d.getDate()).toBe(31)
  })

  it('handles the start of a year as well as the end', () => {
    const d = parseDateOnly('2026-01-01')
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
  })

  it('leaves a full timestamp to the normal parser', () => {
    expect(parseDateOnly('2026-09-01T02:46:14.878Z').toISOString()).toBe('2026-09-01T02:46:14.878Z')
  })

  it('formats a date-only string without shifting it', () => {
    expect(formatDate('2024-12-31')).toContain('2024')
    expect(formatDate('2024-12-31')).toContain('31')
  })
})

describe('titleCaseName', () => {
  it('title-cases CMS all-caps names', () => {
    expect(titleCaseName('MERRY WOOD LODGE')).toBe('Merry Wood Lodge')
  })

  it('keeps small connecting words lower except in first position', () => {
    expect(titleCaseName('THE GRAND REHABILITATION AND NURSING AT BARNWELL')).toBe(
      'The Grand Rehabilitation and Nursing at Barnwell'
    )
  })

  it('leaves an already mixed-case name exactly alone', () => {
    expect(titleCaseName('Rehab At Scottsdale Village Square')).toBe('Rehab At Scottsdale Village Square')
  })

  it('does not mangle tokens containing digits', () => {
    expect(titleCaseName('150 RIVERSIDE CENTER')).toBe('150 Riverside Center')
  })

  it('preserves hyphenation and slashes as separators', () => {
    expect(titleCaseName('PRUITTHEALTH- BARNWELL')).toBe('Pruitthealth- Barnwell')
  })

  // Corporate suffixes read wrong in title case. These were previously only preserved by accident
  // (L, L and C are all Roman numerals), so the behaviour is now pinned deliberately.
  it('keeps corporate suffixes upper-cased, including with trailing punctuation', () => {
    expect(titleCaseName('ATHENS HEALTH AND REHABILITATION LLC')).toBe('Athens Health and Rehabilitation LLC')
    expect(titleCaseName('LIMESTONE NURSING, LLC')).toBe('Limestone Nursing, LLC')
    expect(titleCaseName('WESTSIDE CARE LP')).toBe('Westside Care LP')
  })

  it('title-cases Inc rather than shouting it', () => {
    expect(titleCaseName('HATLEY HEALTH CARE INC')).toBe('Hatley Health Care Inc')
  })

  it('keeps Roman numerals in campus names', () => {
    expect(titleCaseName('OAK MANOR II')).toBe('Oak Manor II')
  })

  it('returns empty input untouched', () => {
    expect(titleCaseName('')).toBe('')
  })
})

describe('getCmsAsOf', () => {
  const snf = (overrides: Partial<SnfRecord> = {}): SnfRecord =>
    ({
      kind: 'snf',
      ccn: '1',
      name: 'X',
      address: '',
      city: '',
      state: '',
      zip: '',
      latitude: null,
      longitude: null,
      certifiedBeds: null,
      avgDailyCensus: null,
      occupancyPct: null,
      overallRating: null,
      healthInspectionRating: null,
      staffingRating: null,
      qualityMeasureRating: null,
      ownershipType: null,
      specialFocusStatus: null,
      specialFocusStatusRaw: null,
      processingDate: '2026-08-01',
      ...overrides
    }) as SnfRecord

  it('returns the CMS processing date for a SNF', () => {
    expect(getCmsAsOf(snf())).toBe('2026-08-01')
  })

  it('returns null when a SNF has no processing date', () => {
    expect(getCmsAsOf(snf({ processingDate: null }))).toBeNull()
  })

  // Hospital records carry no equivalent field. Borrowing the roster fetch date here is what
  // produced the old "metrics as of <save date>" claim on ScoutBoard.
  it('returns null for hospitals rather than borrowing an unrelated date', () => {
    const hospital = { kind: 'hospital', ccn: '2', name: 'H' } as HospitalRecord
    expect(getCmsAsOf(hospital)).toBeNull()
  })
})
