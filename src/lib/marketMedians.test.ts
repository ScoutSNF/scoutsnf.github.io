import { describe, expect, it } from 'vitest'
import { median, computeMarketMedians, describeStandouts, MIN_SAMPLE } from './marketMedians'
import type { SnfRecord } from '../types/facility'
import type { FacilityYearRecord } from '../types/costReport'

function snf(overrides: Partial<SnfRecord> = {}): SnfRecord {
  return {
    kind: 'snf',
    ccn: '111111',
    name: 'Test SNF',
    address: '',
    city: '',
    state: 'IL',
    zip: '',
    latitude: 0,
    longitude: 0,
    certifiedBeds: 100,
    avgDailyCensus: 80,
    occupancyPct: 80,
    overallRating: 3,
    healthInspectionRating: 3,
    staffingRating: 3,
    qualityMeasureRating: 3,
    ownershipType: null,
    specialFocusStatus: null,
    specialFocusStatusRaw: null,
    processingDate: null,
    ...overrides
  } as SnfRecord
}

function costReport(medicaidPct: number | null): FacilityYearRecord[] {
  return [{ fyBeginDate: '2024-01-01', medicaidPct } as FacilityYearRecord]
}

describe('median', () => {
  it('returns the middle value for an odd count', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('averages the two middle values for an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('returns null for an empty set', () => {
    expect(median([])).toBeNull()
  })

  it('does not mutate its input', () => {
    const input = [3, 1, 2]
    median(input)
    expect(input).toEqual([3, 1, 2])
  })
})

describe('computeMarketMedians', () => {
  const competitors = [
    snf({ ccn: 'c1', occupancyPct: 70, overallRating: 2 }),
    snf({ ccn: 'c2', occupancyPct: 75, overallRating: 3 }),
    snf({ ccn: 'c3', occupancyPct: 85, overallRating: 4 }),
    snf({ ccn: 'c4', occupancyPct: 90, overallRating: 5 })
  ]

  it('computes the median across competitors and the anchor delta', () => {
    const anchor = snf({ ccn: 'anchor', occupancyPct: 95 })
    const m = computeMarketMedians(anchor, competitors, new Map())
    expect(m.occupancy.median).toBe(80)
    expect(m.occupancy.anchor).toBe(95)
    expect(m.occupancy.delta).toBe(15)
    expect(m.competitorCount).toBe(4)
  })

  // The anchor is not its own competitor -- including it drags the median toward the very value
  // being compared against it. Uses five facilities so removing one still clears MIN_SAMPLE and
  // the exclusion itself is what moves the median, not the small-sample guard.
  it('excludes the anchor from its own comparison set', () => {
    const five = [...competitors, snf({ ccn: 'c5', occupancyPct: 100, overallRating: 5 })]
    const withAnchorInSet = computeMarketMedians(snf({ ccn: 'other' }), five, new Map())
    expect(withAnchorInSet.occupancy.median).toBe(85)

    const anchorIsC1 = computeMarketMedians(snf({ ccn: 'c1', occupancyPct: 70 }), five, new Map())
    expect(anchorIsC1.competitorCount).toBe(4)
    expect(anchorIsC1.occupancy.median).toBe(87.5)
  })

  it('withholds a median below the minimum sample rather than publishing a noisy one', () => {
    const few = competitors.slice(0, MIN_SAMPLE - 1)
    const m = computeMarketMedians(snf({ ccn: 'anchor' }), few, new Map())
    expect(m.occupancy.median).toBeNull()
    expect(m.occupancy.delta).toBeNull()
    expect(m.occupancy.n).toBe(MIN_SAMPLE - 1)
  })

  it('ignores facilities that do not report a metric instead of treating them as zero', () => {
    const mixed = [
      ...competitors,
      snf({ ccn: 'c5', occupancyPct: null }),
      snf({ ccn: 'c6', occupancyPct: null })
    ]
    const m = computeMarketMedians(snf({ ccn: 'anchor', occupancyPct: 80 }), mixed, new Map())
    expect(m.occupancy.n).toBe(4)
    expect(m.occupancy.median).toBe(80)
    expect(m.competitorCount).toBe(6)
  })

  it('draws Medicaid mix from the latest cost report that reports it', () => {
    const reports = new Map([
      ['c1', costReport(60)],
      ['c2', costReport(65)],
      ['c3', costReport(70)],
      ['c4', costReport(75)],
      ['anchor', costReport(90)]
    ])
    const m = computeMarketMedians(snf({ ccn: 'anchor' }), competitors, reports)
    expect(m.medicaidMix.median).toBe(67.5)
    expect(m.medicaidMix.anchor).toBe(90)
    expect(m.medicaidMix.delta).toBe(22.5)
  })
})

describe('describeStandouts', () => {
  const competitors = [
    snf({ ccn: 'c1', occupancyPct: 70, overallRating: 3 }),
    snf({ ccn: 'c2', occupancyPct: 75, overallRating: 3 }),
    snf({ ccn: 'c3', occupancyPct: 85, overallRating: 3 }),
    snf({ ccn: 'c4', occupancyPct: 90, overallRating: 3 })
  ]

  it('reports occupancy well above the median as a positive', () => {
    const anchor = snf({ ccn: 'a', occupancyPct: 95, overallRating: 3 })
    const out = describeStandouts(computeMarketMedians(anchor, competitors, new Map()), anchor)
    expect(out[0].tone).toBe('good')
    expect(out[0].text).toContain('above')
    expect(out[0].text).toContain('80%')
  })

  it('stays quiet about differences too small to act on', () => {
    const anchor = snf({ ccn: 'a', occupancyPct: 81, overallRating: 3 })
    const out = describeStandouts(computeMarketMedians(anchor, competitors, new Map()), anchor)
    expect(out.map((s) => s.text).join(' ')).not.toContain('Occupancy runs')
  })

  // Special Focus is the single most consequential fact about a SNF and is easy to lose among
  // numbers, so it is called out regardless of how the medians land.
  it('always surfaces Special Focus status', () => {
    const anchor = snf({ ccn: 'a', occupancyPct: 80, overallRating: 3, specialFocusStatus: 'sff' })
    const out = describeStandouts(computeMarketMedians(anchor, competitors, new Map()), anchor)
    expect(out.some((s) => s.text.includes('Special Focus Facility program'))).toBe(true)
  })

  it('distinguishes a candidate from a facility in the program', () => {
    const anchor = snf({ ccn: 'a', occupancyPct: 80, overallRating: 3, specialFocusStatus: 'candidate' })
    const out = describeStandouts(computeMarketMedians(anchor, competitors, new Map()), anchor)
    expect(out.some((s) => s.text.includes('candidate list'))).toBe(true)
    expect(out.some((s) => s.text.includes('Special Focus Facility program'))).toBe(false)
  })

  it('says so plainly when nothing is unusual', () => {
    const anchor = snf({ ccn: 'a', occupancyPct: 80, overallRating: 3 })
    const out = describeStandouts(computeMarketMedians(anchor, competitors, new Map()), anchor)
    expect(out).toHaveLength(1)
    expect(out[0].tone).toBe('neutral')
  })
})
