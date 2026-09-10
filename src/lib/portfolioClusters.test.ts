import { describe, expect, it } from 'vitest'
import { buildPortfolioClusters, findFacilityMarket } from './portfolioClusters'
import type { PortfolioMemberResolved, PortfolioDistance } from './portfolioReport'
import type { SnfRecord, HospitalRecord } from '../types/facility'

function snf(ccn: string, overrides: Partial<SnfRecord> = {}): SnfRecord {
  return {
    kind: 'snf',
    ccn,
    name: `SNF ${ccn}`,
    address: '1 Main St',
    city: 'Olney',
    state: 'IL',
    zip: '62450',
    latitude: 38.73,
    longitude: -88.08,
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
  }
}

function hospital(ccn: string, overrides: Partial<HospitalRecord> = {}): HospitalRecord {
  return {
    kind: 'hospital',
    ccn,
    name: `Hospital ${ccn}`,
    address: '1 Main St',
    city: 'Olney',
    state: 'IL',
    zip: '62450',
    latitude: 38.73,
    longitude: -88.08,
    hospitalType: 'Acute Care',
    hospitalTypeRaw: 'Acute Care Hospitals',
    overallRating: 3,
    emergencyServices: true,
    certifiedBeds: 50,
    occupancyPct: null,
    ...overrides
  }
}

function member(facility: SnfRecord | HospitalRecord, radiusMiles = 15): PortfolioMemberResolved {
  return {
    row: {
      id: `${facility.kind}:${facility.ccn}`,
      ccn: facility.ccn,
      kind: facility.kind,
      name: facility.name,
      city: facility.city,
      state: facility.state,
      radiusMiles,
      notes: '',
      savedAt: new Date().toISOString(),
      order: 0
    },
    facility
  }
}

function dist(a: PortfolioMemberResolved, b: PortfolioMemberResolved, distanceMiles: number): PortfolioDistance {
  return { a, b, distanceMiles }
}

describe('buildPortfolioClusters', () => {
  it('clusters transitively via union-find, flags cannibalization, and puts a far facility in standalones', () => {
    const richland = member(snf('R1', { name: 'Richland Nursing & Rehab', city: 'Olney' }))
    const helenaOlney = member(snf('O1', { name: 'Helia Healthcare of Olney', city: 'Olney' }))
    const helenaNewton = member(snf('N1', { name: 'Helia Healthcare of Newton', city: 'Newton' }))
    const farAway = member(snf('F1', { name: 'Far Away SNF', city: 'Springfield' }))

    const distances = [
      dist(richland, helenaOlney, 0.68), // cannibalization
      dist(richland, helenaNewton, 30), // not directly connected
      dist(helenaOlney, helenaNewton, 24.05), // connects via Olney
      dist(richland, farAway, 100),
      dist(helenaOlney, farAway, 100),
      dist(helenaNewton, farAway, 100)
    ]

    const result = buildPortfolioClusters(
      [richland, helenaOlney, helenaNewton, farAway],
      distances,
      [],
      [],
      25,
      15
    )

    expect(result.clusters).toHaveLength(1)
    const cluster = result.clusters[0]
    expect(cluster.members.map((m) => m.facility.ccn).sort()).toEqual(['N1', 'O1', 'R1'])
    expect(cluster.cannibalizationPairs).toHaveLength(1)
    expect(cluster.cannibalizationPairs[0].miles).toBe(0.68)

    expect(result.standalones).toHaveLength(1)
    expect(result.standalones[0].member.facility.ccn).toBe('F1')
    expect(result.standalones[0].hasLocation).toBe(true)
    // Nearest portfolio facility to the far-away one is whichever of the cluster it's closest to (all 100mi here, first found).
    expect(result.standalones[0].nearestPortfolioMiles).toBe(100)
  })

  it('drops below the cluster threshold and splits into standalones', () => {
    const a = member(snf('A1'))
    const b = member(snf('B1'))
    const c = member(snf('C1'))
    const distances = [dist(a, b, 0.68), dist(b, c, 24.05), dist(a, c, 30)]

    const result = buildPortfolioClusters([a, b, c], distances, [], [], 15, 15)

    // a-b still clusters (0.68 <= 15), but c drops out since 24.05 > 15
    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0].members.map((m) => m.facility.ccn).sort()).toEqual(['A1', 'B1'])
    expect(result.standalones.map((s) => s.member.facility.ccn)).toEqual(['C1'])
  })

  it('excludes portfolio CCNs from intruders, dedupes by CCN keeping the nearest distance, and separates hospitals', () => {
    const memberA = member(snf('A1', { latitude: 38.7, longitude: -88.0 }))
    const memberB = member(snf('B1', { latitude: 38.72, longitude: -88.0 })) // ~1.4mi from A

    const intruder = snf('X1', { name: 'Intruder SNF', latitude: 38.705, longitude: -88.0 }) // near both A and B
    const portfolioLookalike = snf('A1', { name: 'Should be excluded — same CCN as a member' })
    const referral = hospital('H1', { name: 'Referral Hospital', latitude: 38.71, longitude: -88.0 })

    const distances = [dist(memberA, memberB, 1.4)]

    const result = buildPortfolioClusters(
      [memberA, memberB],
      distances,
      [intruder, portfolioLookalike],
      [referral],
      25,
      15
    )

    expect(result.clusters).toHaveLength(1)
    const cluster = result.clusters[0]
    expect(cluster.intruders.map((i) => i.ccn)).toEqual(['X1']) // portfolio CCN excluded, no duplicate
    expect(cluster.referralHospitals.map((h) => h.ccn)).toEqual(['H1'])
  })

  it('names clusters by city, collapsing beyond 3 distinct cities', () => {
    const a = member(snf('A1', { city: 'Olney', certifiedBeds: 100 }))
    const b = member(snf('B1', { city: 'Newton', certifiedBeds: 50 }))
    const distances = [dist(a, b, 5)]
    const twoCity = buildPortfolioClusters([a, b], distances, [], [], 25, 15)
    expect(twoCity.clusters[0].name).toBe('Olney / Newton')

    const c = member(snf('C1', { city: 'Effingham', certifiedBeds: 20 }))
    const d = member(snf('D1', { city: 'Salem', certifiedBeds: 10 }))
    const distances4 = [dist(a, b, 5), dist(b, c, 5), dist(c, d, 5)]
    const fourCity = buildPortfolioClusters([a, b, c, d], distances4, [], [], 25, 15)
    expect(fourCity.clusters[0].name).toBe('Olney / Newton +2 more')
  })

  it('excludes facilities missing coordinates from clustering and marks them standalone without a nearest facility', () => {
    const a = member(snf('A1'))
    const noLoc = member(snf('B1', { latitude: null, longitude: null }))
    const result = buildPortfolioClusters([a, noLoc], [], [], [], 25, 15)

    expect(result.clusters).toHaveLength(0)
    const standaloneIds = result.standalones.map((s) => s.member.facility.ccn).sort()
    expect(standaloneIds).toEqual(['A1', 'B1'])
    const missing = result.standalones.find((s) => s.member.facility.ccn === 'B1')!
    expect(missing.hasLocation).toBe(false)
    expect(missing.nearestPortfolioMember).toBeNull()
  })

  it('computes a bed-weighted average occupancy, ignoring members missing beds or occupancy', () => {
    const a = member(snf('A1', { certifiedBeds: 100, occupancyPct: 90 }))
    const b = member(snf('B1', { certifiedBeds: 50, occupancyPct: 60 }))
    const noOcc = member(snf('C1', { certifiedBeds: 200, occupancyPct: null }))
    const distances = [dist(a, b, 1), dist(b, noOcc, 1), dist(a, noOcc, 1)]
    const result = buildPortfolioClusters([a, b, noOcc], distances, [], [], 25, 15)

    // (100*90 + 50*60) / (100+50) = 80
    expect(result.clusters[0].weightedOccupancy).toBe(80)
    expect(result.clusters[0].totalBeds).toBe(350)
  })
})

describe('findFacilityMarket', () => {
  it('finds competitors and referral hospitals near a single anchor, excluding the whole portfolio', () => {
    const anchor = member(snf('A1', { latitude: 38.7, longitude: -88.0 }))
    const otherMember = member(snf('B1', { latitude: 38.9, longitude: -88.0 }))
    const competitor = snf('X1', { latitude: 38.705, longitude: -88.0 })
    const referral = hospital('H1', { latitude: 38.71, longitude: -88.0 })

    const result = findFacilityMarket(anchor, [anchor, otherMember], [competitor, snf('B1')], [referral], 15)

    expect(result.competitors.map((c) => c.ccn)).toEqual(['X1'])
    expect(result.referralHospitals.map((h) => h.ccn)).toEqual(['H1'])
  })
})
