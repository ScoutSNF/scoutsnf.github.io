import { describe, expect, it } from 'vitest'
import { searchFacilities } from './search'
import type { SnfRecord, HospitalRecord } from '../types/facility'

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
    specialFocusStatus: null,
    specialFocusStatusRaw: null,
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

describe('searchFacilities', () => {
  it('matches by name, city, or ZIP as free text', () => {
    const richland = snf({ ccn: 'R1', name: 'Richland Nursing & Rehab', city: 'Olney', zip: '62450' })
    const helia = snf({ ccn: 'H1', name: 'Helia Healthcare of Olney', city: 'Olney', zip: '62450' })
    const other = snf({ ccn: 'O1', name: 'Somewhere Else', city: 'Peoria', zip: '61601' })

    expect(searchFacilities('richland', [richland, helia, other], []).hits.map((h) => h.facility.ccn)).toEqual(['R1'])
    expect(searchFacilities('olney', [richland, helia, other], []).hits.map((h) => h.facility.ccn).sort()).toEqual(['H1', 'R1'])
    expect(searchFacilities('62450', [richland, helia, other], []).hits.map((h) => h.facility.ccn).sort()).toEqual(['H1', 'R1'])
  })

  it('ranks a name match above a city match', () => {
    const nameMatch = snf({ ccn: 'N1', name: 'Olney Care Center', city: 'Chicago' })
    const cityMatch = snf({ ccn: 'C1', name: 'Somewhere Else', city: 'Olney' })
    const { hits } = searchFacilities('olney', [nameMatch, cityMatch], [])
    expect(hits.map((h) => h.facility.ccn)).toEqual(['N1', 'C1'])
  })

  it('filters by state with no text query', () => {
    const il = snf({ ccn: 'IL1', state: 'IL' })
    const ny = snf({ ccn: 'NY1', state: 'NY' })
    const { hits } = searchFacilities('', [il, ny], [], { state: 'NY' })
    expect(hits.map((h) => h.facility.ccn)).toEqual(['NY1'])
  })

  it('filters by kind', () => {
    const s = snf({ ccn: 'S1' })
    const h = hospital({ ccn: 'H1' })
    expect(searchFacilities('', [s], [h], { kind: 'hospital' }).hits.map((r) => r.facility.ccn)).toEqual(['H1'])
    expect(searchFacilities('', [s], [h], { kind: 'snf' }).hits.map((r) => r.facility.ccn)).toEqual(['S1'])
  })

  it('filters by a bed count range', () => {
    const small = snf({ ccn: 'SM', certifiedBeds: 50 })
    const mid = snf({ ccn: 'MD', certifiedBeds: 120 })
    const large = snf({ ccn: 'LG', certifiedBeds: 300 })
    const { hits } = searchFacilities('', [small, mid, large], [], { bedsMin: 100, bedsMax: 200 })
    expect(hits.map((h) => h.facility.ccn)).toEqual(['MD'])
  })

  it('filters by Special Focus Facility, ignoring hospitals entirely', () => {
    const sffSnf = snf({ ccn: 'SFF1', specialFocusStatus: 'sff' })
    const candidateSnf = snf({ ccn: 'CAND1', specialFocusStatus: 'candidate' })
    const plainSnf = snf({ ccn: 'PLN1', specialFocusStatus: null })
    const anyHospital = hospital({ ccn: 'HOSP1' })
    const { hits } = searchFacilities('', [sffSnf, candidateSnf, plainSnf], [anyHospital], { specialFocus: 'sff' })
    expect(hits.map((h) => h.facility.ccn)).toEqual(['SFF1'])
  })

  // The whole point of the split: a candidate must not answer a search for facilities actually in
  // the program, which is what the previous boolean did for ~440 facilities nationally.
  it('does not return SFF candidates when filtering for real SFFs', () => {
    const candidateSnf = snf({ ccn: 'CAND1', specialFocusStatus: 'candidate' })
    const { hits } = searchFacilities('', [candidateSnf], [], { specialFocus: 'sff' })
    expect(hits).toEqual([])
  })

  it('filters for candidates alone, and for either together', () => {
    const sffSnf = snf({ ccn: 'SFF1', specialFocusStatus: 'sff' })
    const candidateSnf = snf({ ccn: 'CAND1', specialFocusStatus: 'candidate' })
    const plainSnf = snf({ ccn: 'PLN1', specialFocusStatus: null })
    const roster = [sffSnf, candidateSnf, plainSnf]

    expect(searchFacilities('', roster, [], { specialFocus: 'candidate' }).hits.map((h) => h.facility.ccn)).toEqual(['CAND1'])
    expect(searchFacilities('', roster, [], { specialFocus: 'any' }).hits.map((h) => h.facility.ccn).sort()).toEqual(['CAND1', 'SFF1'])
  })

  // A browser holding a roster cached before the split has only the old boolean.
  it('reads the legacy specialFocusFacility flag from a stale cache as a full SFF', () => {
    const legacy = snf({ ccn: 'OLD1', specialFocusStatus: undefined, specialFocusFacility: true })
    const { hits } = searchFacilities('', [legacy], [], { specialFocus: 'sff' })
    expect(hits.map((h) => h.facility.ccn)).toEqual(['OLD1'])
  })

  it('combines a text query with structured filters as AND', () => {
    const match = snf({ ccn: 'M1', name: 'Match Name', state: 'IL', certifiedBeds: 150 })
    const wrongState = snf({ ccn: 'M2', name: 'Match Name', state: 'NY', certifiedBeds: 150 })
    const tooFewBeds = snf({ ccn: 'M3', name: 'Match Name', state: 'IL', certifiedBeds: 10 })
    const { hits } = searchFacilities('match', [match, wrongState, tooFewBeds], [], { state: 'IL', bedsMin: 100 })
    expect(hits.map((h) => h.facility.ccn)).toEqual(['M1'])
  })

  it('returns nothing for a query shorter than 2 chars and no filters', () => {
    expect(searchFacilities('a', [snf()], [])).toEqual({ hits: [], total: 0 })
    expect(searchFacilities('', [snf()], [])).toEqual({ hits: [], total: 0 })
  })

  // Browsing a filter-driven set (441 SFF candidates nationally) has to be possible, and when
  // the cap does bite, `total` has to say so -- a truncated list is otherwise indistinguishable
  // from a complete one.
  it('reports the true match count when results are capped', () => {
    const roster = Array.from({ length: 30 }, (_, i) => snf({ ccn: `C${i}`, state: 'IL' }))
    const capped = searchFacilities('', roster, [], { state: 'IL' }, 10)
    expect(capped.hits).toHaveLength(10)
    expect(capped.total).toBe(30)

    const uncapped = searchFacilities('', roster, [], { state: 'IL' })
    expect(uncapped.hits).toHaveLength(30)
    expect(uncapped.total).toBe(30)
  })

  it('a bare filter set with no text query is a valid search on its own', () => {
    const il = snf({ ccn: 'IL1', state: 'IL' })
    const ny = snf({ ccn: 'NY1', state: 'NY' })
    const { hits } = searchFacilities('', [il, ny], [], { state: 'IL' })
    expect(hits.length).toBe(1)
  })
})
