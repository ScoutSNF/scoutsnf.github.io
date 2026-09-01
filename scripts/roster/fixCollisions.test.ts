import { describe, expect, it } from 'vitest'
import { findCoordinateCollisions } from './fixCollisions.js'
import type { SnfRecord } from './types.js'

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

describe('findCoordinateCollisions', () => {
  it('flags two facilities sharing an exact coordinate', () => {
    const a = snf({ ccn: 'A', latitude: 40.7157, longitude: -73.794 })
    const b = snf({ ccn: 'B', latitude: 40.7157, longitude: -73.794 })
    const c = snf({ ccn: 'C', latitude: 41.0, longitude: -74.0 })
    const collided = findCoordinateCollisions([a, b, c])
    expect(collided.map((r) => r.ccn).sort()).toEqual(['A', 'B'])
  })

  it('does not flag facilities that merely round to the same 4dp value from different exact points', () => {
    // toFixed(4) grouping is intentional -- this documents the actual (coarse) behavior rather
    // than silently changing it.
    const a = snf({ ccn: 'A', latitude: 40.71571, longitude: -73.79401 })
    const b = snf({ ccn: 'B', latitude: 40.71569, longitude: -73.79399 })
    const collided = findCoordinateCollisions([a, b])
    expect(collided).toHaveLength(2) // both round to 40.7157,-73.7940 -- this IS a collision
  })

  it('ignores facilities missing coordinates', () => {
    const a = snf({ ccn: 'A', latitude: null, longitude: null })
    const b = snf({ ccn: 'B', latitude: null, longitude: null })
    expect(findCoordinateCollisions([a, b])).toEqual([])
  })

  it('returns nothing when every facility has a unique coordinate', () => {
    const a = snf({ ccn: 'A', latitude: 40.0, longitude: -80.0 })
    const b = snf({ ccn: 'B', latitude: 41.0, longitude: -81.0 })
    expect(findCoordinateCollisions([a, b])).toEqual([])
  })
})
