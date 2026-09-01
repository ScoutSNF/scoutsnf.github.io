import { describe, expect, it } from 'vitest'
import { validateRoster } from './validate.js'
import type { SnfRecord, HospitalRecord } from './types.js'

function snf(overrides: Partial<SnfRecord> = {}): SnfRecord {
  return {
    kind: 'snf',
    ccn: '111111',
    name: 'Test SNF',
    address: '1 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    latitude: 39.8,
    longitude: -89.6,
    certifiedBeds: 100,
    avgDailyCensus: 80,
    occupancyPct: 80,
    overallRating: 3,
    healthInspectionRating: 3,
    staffingRating: 3,
    qualityMeasureRating: 3,
    ownershipType: null,
    specialFocusFacility: false,
    processingDate: null,
    ...overrides
  }
}

function hospital(overrides: Partial<HospitalRecord> = {}): HospitalRecord {
  return {
    kind: 'hospital',
    ccn: '222222',
    name: 'Test Hospital',
    address: '2 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    latitude: 39.8,
    longitude: -89.6,
    hospitalType: 'Acute Care',
    hospitalTypeRaw: 'Acute Care Hospitals',
    overallRating: 3,
    emergencyServices: true,
    certifiedBeds: 50,
    occupancyPct: null,
    ...overrides
  }
}

describe('validateRoster', () => {
  it('passes for a clean, populated roster', () => {
    expect(validateRoster([snf()], [hospital()])).toEqual([])
  })

  it('fails on an empty SNF or hospital roster', () => {
    expect(validateRoster([], [hospital()])).toContain('SNF roster is empty')
    expect(validateRoster([snf()], [])).toContain('Hospital roster is empty')
  })

  it('fails on duplicate CCNs within a roster', () => {
    const issues = validateRoster([snf({ ccn: 'A' }), snf({ ccn: 'A' })], [hospital()])
    expect(issues.some((i) => i.includes('duplicate SNF CCN'))).toBe(true)
  })

  it('fails on an out-of-bounds coordinate', () => {
    const issues = validateRoster([snf({ latitude: 0, longitude: 0 })], [hospital()])
    expect(issues.some((i) => i.includes('out-of-bounds'))).toBe(true)
  })

  it('does not flag a facility with no coordinates yet (unresolved, not invalid)', () => {
    const issues = validateRoster([snf({ latitude: null, longitude: null })], [hospital()])
    expect(issues).toEqual([])
  })

  it('fails when the SNF count drops more than the threshold vs. the previous build', () => {
    const issues = validateRoster([snf()], [hospital()], { snfCount: 100, hospitalCount: 1 })
    expect(issues.some((i) => i.includes('SNF count dropped'))).toBe(true)
  })

  it('tolerates a small count drop within the threshold', () => {
    const nineSnfs = Array.from({ length: 9 }, (_, i) => snf({ ccn: `S${i}` }))
    const issues = validateRoster(nineSnfs, [hospital()], { snfCount: 10, hospitalCount: 1 })
    expect(issues).toEqual([])
  })

  it('does not flag a count increase', () => {
    const issues = validateRoster([snf(), snf({ ccn: 'B' })], [hospital()], { snfCount: 1, hospitalCount: 1 })
    expect(issues).toEqual([])
  })
})
