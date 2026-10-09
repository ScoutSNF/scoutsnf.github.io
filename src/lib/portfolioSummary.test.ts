import { describe, it, expect } from 'vitest'
import { buildPortfolioSummary, describeComparisonSet, formatMetric, MIN_RADIUS_PEERS } from './portfolioSummary'
import type { PortfolioMemberResolved } from './portfolioReport'
import type { SnfRecord, HospitalRecord } from '../types/facility'
import type { SavedFacilityRow } from '../data/db'

function snf(ccn: string, o: Partial<SnfRecord> = {}): SnfRecord {
  return {
    kind: 'snf',
    ccn,
    name: `HOME ${ccn}`,
    address: '1 Main St',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    latitude: 39.8,
    longitude: -89.65,
    certifiedBeds: 100,
    avgDailyCensus: 80,
    occupancyPct: 80,
    overallRating: 3,
    healthInspectionRating: 3,
    staffingRating: 3,
    qualityMeasureRating: 3,
    totalNurseStaffingHprd: 3.5,
    county: 'Sangamon',
    ownershipType: 'For profit',
    specialFocusStatus: null,
    specialFocusStatusRaw: null,
    processingDate: '2026-08-01',
    ...o
  }
}

function member(facility: SnfRecord | HospitalRecord, radiusMiles = 10): PortfolioMemberResolved {
  const row = {
    id: `${facility.kind}:${facility.ccn}`,
    kind: facility.kind,
    ccn: facility.ccn,
    name: facility.name,
    city: facility.city,
    state: facility.state,
    radiusMiles,
    notes: '',
    savedAt: '2026-01-01T00:00:00.000Z',
    sortIndex: 0
  } as unknown as SavedFacilityRow
  return { row, facility }
}

/** Five neighbours so the radius basis is used, each with the given value for every metric. */
function neighbours(values: number[], o: Partial<SnfRecord> = {}): SnfRecord[] {
  return values.map((v, i) =>
    snf(`N${i}`, {
      overallRating: v,
      staffingRating: v,
      healthInspectionRating: v,
      occupancyPct: v,
      totalNurseStaffingHprd: v,
      ...o
    })
  )
}

describe('buildPortfolioSummary', () => {
  it('marks a home above its area median as better and below as worse', () => {
    const home = snf('H1', { staffingRating: 5, occupancyPct: 60 })
    const peers = neighbours([3, 3, 3, 3, 3], { occupancyPct: 80 })
    const { rows } = buildPortfolioSummary([member(home)], [home, ...peers])
    expect(rows[0].metrics.staffingRating.direction).toBe('better') // 5 against a median of 3
    expect(rows[0].metrics.occupancyPct.direction).toBe('worse') // 60% against a median of 80%
  })

  // Higher is better for every column, which is what lets one comparison serve all five.
  it('treats a gap inside the neutral band as neither better nor worse', () => {
    const home = snf('H1', { occupancyPct: 101 }) // +1% against a median of 100
    const { rows } = buildPortfolioSummary([member(home)], [home, ...neighbours([100, 100, 100, 100, 100])])
    expect(rows[0].metrics.occupancyPct.direction).toBe('same')

    const further = snf('H2', { occupancyPct: 105 }) // +5%
    const out = buildPortfolioSummary([member(further)], [further, ...neighbours([100, 100, 100, 100, 100])])
    expect(out.rows[0].metrics.occupancyPct.direction).toBe('better')
  })

  it('never counts a missing metric as zero', () => {
    const home = snf('H1', { occupancyPct: null, totalNurseStaffingHprd: undefined })
    const { rows } = buildPortfolioSummary([member(home)], [home, ...neighbours([3, 3, 3, 3, 3])])
    expect(rows[0].metrics.occupancyPct.value).toBeNull()
    expect(rows[0].metrics.occupancyPct.direction).toBe('same')
    expect(rows[0].metrics.totalNurseStaffingHprd.value).toBeNull()
    expect(formatMetric(rows[0].metrics.occupancyPct.value, 'occupancyPct')).toBe('—')
  })

  it('excludes the home itself from its own comparison set', () => {
    const home = snf('H1', { staffingRating: 5 })
    const { rows } = buildPortfolioSummary([member(home)], [home, ...neighbours([1, 1, 1, 1, 1])])
    expect(rows[0].peerCount).toBe(5)
    expect(rows[0].metrics.staffingRating.median).toBe(1)
  })

  it('falls back to the county median when the radius is too thin', () => {
    const home = snf('H1', { staffingRating: 5, county: 'Sangamon' })
    // Four neighbours in radius -- one short of the threshold -- plus far-away county members.
    const near = neighbours([1, 1, 1, 1])
    const far = neighbours([4, 4, 4, 4, 4, 4]).map((f, i) =>
      snf(`F${i}`, { ...f, ccn: `F${i}`, latitude: 41.9, longitude: -87.6, county: 'Sangamon' })
    )
    const { rows } = buildPortfolioSummary([member(home)], [home, ...near, ...far])
    expect(near.length).toBeLessThan(MIN_RADIUS_PEERS)
    expect(rows[0].basis).toBe('county')
    // The county set is every SNF in the county, which includes the four nearby ones -- falling
    // back widens the comparison rather than swapping one set for another.
    expect(rows[0].peerCount).toBe(near.length + far.length)
    expect(describeComparisonSet(rows[0])).toBe('vs 10 SNFs in Sangamon County')
  })

  it('keeps the radius basis once there are enough neighbours', () => {
    const home = snf('H1')
    const { rows } = buildPortfolioSummary([member(home, 10)], [home, ...neighbours([3, 3, 3, 3, 3])])
    expect(rows[0].basis).toBe('radius')
    expect(describeComparisonSet(rows[0])).toBe('vs 5 SNFs within 10 mi')
  })

  it('reports no comparison rather than inventing one when a home is isolated', () => {
    const home = snf('H1', { county: null })
    const { rows } = buildPortfolioSummary([member(home)], [home])
    expect(rows[0].basis).toBe('none')
    expect(rows[0].peerCount).toBe(0)
    expect(rows[0].metrics.staffingRating.median).toBeNull()
    expect(describeComparisonSet(rows[0])).toBe('No comparable SNFs nearby')
  })

  it('uses each home its own saved radius', () => {
    const a = snf('A', { latitude: 39.8, longitude: -89.65 })
    // ~35 miles away, so it is a peer at 40 mi but not at 10 mi.
    const b = snf('B', { latitude: 40.3, longitude: -89.65 })
    const all = [a, b, ...neighbours([3, 3, 3, 3, 3])]
    const { rows } = buildPortfolioSummary([member(a, 10), member(b, 40)], all)
    expect(rows[0].radiusMiles).toBe(10)
    expect(rows[1].radiusMiles).toBe(40)
    expect(rows[1].peerCount).toBeGreaterThan(0)
  })

  it('leaves hospitals out: they are not homes and carry none of these metrics', () => {
    const home = snf('H1')
    const hospital = { kind: 'hospital', ccn: 'X1', name: 'GENERAL', city: 'Springfield', state: 'IL' } as HospitalRecord
    const { rows } = buildPortfolioSummary(
      [member(home), member(hospital)],
      [home, ...neighbours([3, 3, 3, 3, 3])]
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].ccn).toBe('H1')
  })
})

describe('headline', () => {
  it('counts only homes that have a staffing comparison', () => {
    const good = snf('H1', { staffingRating: 5 })
    const alsoGood = snf('H2', { staffingRating: 5 })
    const unknown = snf('H3', { staffingRating: null })
    const { headline } = buildPortfolioSummary(
      [member(good), member(alsoGood), member(unknown)],
      [good, alsoGood, unknown, ...neighbours([3, 3, 3, 3, 3])]
    )
    // Three homes, but only two can be compared.
    expect(headline).toContain('2 of 2 homes beat their area median on staffing.')
  })

  it('names the home that is behind on the most metrics', () => {
    const strong = snf('H1', { name: 'STRONG HOME', staffingRating: 5, overallRating: 5, occupancyPct: 95 })
    const weak = snf('H2', { name: 'BATAVIA', staffingRating: 1, overallRating: 1, occupancyPct: 40 })
    const { headline } = buildPortfolioSummary(
      [member(strong), member(weak)],
      [strong, weak, ...neighbours([3, 3, 3, 3, 3])]
    )
    expect(headline).toContain('Weakest: Batavia')
    expect(headline).toContain('below the area).')
  })

  it('says so plainly when nothing can be compared', () => {
    const home = snf('H1', { county: null })
    const { headline } = buildPortfolioSummary([member(home)], [home])
    expect(headline).toContain('No staffing comparison is available')
  })

  it('omits the weakest sentence when no home is behind', () => {
    const home = snf('H1', { staffingRating: 5, overallRating: 5, occupancyPct: 95, healthInspectionRating: 5, totalNurseStaffingHprd: 9 })
    const { headline } = buildPortfolioSummary([member(home)], [home, ...neighbours([3, 3, 3, 3, 3])])
    expect(headline).not.toContain('Weakest')
  })
})
