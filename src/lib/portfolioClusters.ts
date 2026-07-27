import type { SnfRecord, HospitalRecord } from '../types/facility'
import type { PortfolioMemberResolved, PortfolioDistance } from './portfolioReport'
import { withinRadius } from './market'

/** Two portfolio facilities close enough to directly cannibalize each other's census. */
export const CANNIBALIZATION_THRESHOLD_MILES = 5

export interface CannibalizationPair {
  memberA: PortfolioMemberResolved
  memberB: PortfolioMemberResolved
  miles: number
}

export interface MarketFacility {
  ccn: string
  name: string
  city: string
  state: string
  beds: number | null
  overallStars: number | null
  occupancy: number | null
  nearestMemberCcn: string
  nearestMemberName: string
  nearestMemberMiles: number
  /** Full record, kept alongside the flattened fields above so actions like "compare vs anchor" have it. */
  facility: SnfRecord | HospitalRecord
}

export interface Cluster {
  /** Stable across re-renders: sorted member CCNs joined together. */
  id: string
  name: string
  members: PortfolioMemberResolved[]
  totalBeds: number
  /** Bed-weighted average occupancy across members with both beds and occupancy known. Null if none qualify. */
  weightedOccupancy: number | null
  cannibalizationPairs: CannibalizationPair[]
  intruders: MarketFacility[]
  referralHospitals: MarketFacility[]
}

export interface StandaloneFacility {
  member: PortfolioMemberResolved
  hasLocation: boolean
  nearestPortfolioMember: PortfolioMemberResolved | null
  nearestPortfolioMiles: number | null
}

export interface PortfolioClusterResult {
  clusters: Cluster[]
  standalones: StandaloneFacility[]
}

function memberId(m: PortfolioMemberResolved): string {
  return `${m.facility.kind}:${m.facility.ccn}`
}

function findRoot(parent: Map<string, string>, id: string): string {
  let root = id
  while (parent.get(root) !== root) root = parent.get(root)!
  let cur = id
  while (cur !== root) {
    const next = parent.get(cur)!
    parent.set(cur, root)
    cur = next
  }
  return root
}

function union(parent: Map<string, string>, a: string, b: string) {
  const ra = findRoot(parent, a)
  const rb = findRoot(parent, b)
  if (ra !== rb) parent.set(ra, rb)
}

/** "Olney / Newton / Effingham"; beyond 3 distinct cities, the two largest by member beds + "+N more". */
function clusterName(members: PortfolioMemberResolved[]): string {
  const bedsByCity = new Map<string, number>()
  for (const m of members) {
    const city = m.facility.city
    bedsByCity.set(city, (bedsByCity.get(city) ?? 0) + (m.facility.certifiedBeds ?? 0))
  }
  const cities = [...bedsByCity.keys()]
  const byBedsDesc = [...cities].sort((a, b) => bedsByCity.get(b)! - bedsByCity.get(a)! || a.localeCompare(b))
  if (cities.length <= 3) return byBedsDesc.join(' / ')
  return `${byBedsDesc.slice(0, 2).join(' / ')} +${cities.length - 2} more`
}

function weightedOccupancy(members: PortfolioMemberResolved[]): number | null {
  let weightedSum = 0
  let totalWeight = 0
  for (const m of members) {
    const beds = m.facility.certifiedBeds
    const occ = m.facility.occupancyPct
    if (beds == null || occ == null) continue
    weightedSum += occ * beds
    totalWeight += beds
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null
}

function findCannibalizationPairs(members: PortfolioMemberResolved[], distances: PortfolioDistance[]): CannibalizationPair[] {
  const ids = new Set(members.map(memberId))
  const pairs: CannibalizationPair[] = []
  for (const d of distances) {
    if (d.distanceMiles > CANNIBALIZATION_THRESHOLD_MILES) continue
    if (!ids.has(memberId(d.a)) || !ids.has(memberId(d.b))) continue
    pairs.push({ memberA: d.a, memberB: d.b, miles: d.distanceMiles })
  }
  return pairs.sort((a, b) => a.miles - b.miles)
}

/** One radius query per cluster member, unioned and deduped by CCN, keeping the nearest-member distance. */
function findMarketFacilities<T extends SnfRecord | HospitalRecord>(
  clusterMembers: PortfolioMemberResolved[],
  pool: T[],
  poolKind: T['kind'],
  excludeCcns: Set<string>,
  radiusMiles: number
): MarketFacility[] {
  const best = new Map<string, MarketFacility>()
  for (const member of clusterMembers) {
    if (member.facility.latitude == null || member.facility.longitude == null) continue
    const nearby = withinRadius(
      { latitude: member.facility.latitude, longitude: member.facility.longitude },
      pool,
      radiusMiles,
      member.facility.kind === poolKind ? member.facility.ccn : undefined
    ).filter((r) => !excludeCcns.has(r.facility.ccn))

    for (const r of nearby) {
      const existing = best.get(r.facility.ccn)
      if (existing && existing.nearestMemberMiles <= r.distanceMiles) continue
      best.set(r.facility.ccn, {
        ccn: r.facility.ccn,
        name: r.facility.name,
        city: r.facility.city,
        state: r.facility.state,
        beds: r.facility.certifiedBeds,
        overallStars: r.facility.overallRating,
        occupancy: r.facility.occupancyPct,
        nearestMemberCcn: member.facility.ccn,
        nearestMemberName: member.row.name,
        nearestMemberMiles: r.distanceMiles,
        facility: r.facility
      })
    }
  }
  return [...best.values()].sort((a, b) => a.nearestMemberMiles - b.nearestMemberMiles)
}

export function buildPortfolioClusters(
  members: PortfolioMemberResolved[],
  distances: PortfolioDistance[],
  snfs: SnfRecord[],
  hospitals: HospitalRecord[],
  clusterThresholdMiles: number,
  competitorRadiusMiles: number
): PortfolioClusterResult {
  const memberSnfCcns = new Set(members.filter((m) => m.facility.kind === 'snf').map((m) => m.facility.ccn))
  const memberHospitalCcns = new Set(members.filter((m) => m.facility.kind === 'hospital').map((m) => m.facility.ccn))

  const located = members.filter((m) => m.facility.latitude != null && m.facility.longitude != null)
  const noLocation = members.filter((m) => m.facility.latitude == null || m.facility.longitude == null)

  const parent = new Map<string, string>()
  for (const m of located) parent.set(memberId(m), memberId(m))
  for (const d of distances) {
    if (d.distanceMiles > clusterThresholdMiles) continue
    const idA = memberId(d.a)
    const idB = memberId(d.b)
    if (parent.has(idA) && parent.has(idB)) union(parent, idA, idB)
  }

  const groups = new Map<string, PortfolioMemberResolved[]>()
  for (const m of located) {
    const root = findRoot(parent, memberId(m))
    const group = groups.get(root) ?? []
    group.push(m)
    groups.set(root, group)
  }

  const clusters: Cluster[] = []
  const standaloneMembers: PortfolioMemberResolved[] = []

  for (const groupMembers of groups.values()) {
    if (groupMembers.length < 2) {
      standaloneMembers.push(groupMembers[0])
      continue
    }
    const id = groupMembers
      .map(memberId)
      .sort()
      .join('|')
    clusters.push({
      id,
      name: clusterName(groupMembers),
      members: groupMembers,
      totalBeds: groupMembers.reduce((sum, m) => sum + (m.facility.certifiedBeds ?? 0), 0),
      weightedOccupancy: weightedOccupancy(groupMembers),
      cannibalizationPairs: findCannibalizationPairs(groupMembers, distances),
      intruders: findMarketFacilities(groupMembers, snfs, 'snf', memberSnfCcns, competitorRadiusMiles),
      referralHospitals: findMarketFacilities(groupMembers, hospitals, 'hospital', memberHospitalCcns, competitorRadiusMiles)
    })
  }
  clusters.sort((a, b) => b.members.length - a.members.length || a.name.localeCompare(b.name))

  function nearestPortfolioMember(m: PortfolioMemberResolved): { member: PortfolioMemberResolved; miles: number } | null {
    let best: { member: PortfolioMemberResolved; miles: number } | null = null
    for (const d of distances) {
      let other: PortfolioMemberResolved | null = null
      if (memberId(d.a) === memberId(m)) other = d.b
      else if (memberId(d.b) === memberId(m)) other = d.a
      if (!other) continue
      if (!best || d.distanceMiles < best.miles) best = { member: other, miles: d.distanceMiles }
    }
    return best
  }

  const standalones: StandaloneFacility[] = [
    ...standaloneMembers.map((m) => {
      const nearest = nearestPortfolioMember(m)
      return {
        member: m,
        hasLocation: true,
        nearestPortfolioMember: nearest?.member ?? null,
        nearestPortfolioMiles: nearest?.miles ?? null
      }
    }),
    ...noLocation.map((m) => ({
      member: m,
      hasLocation: false,
      nearestPortfolioMember: null,
      nearestPortfolioMiles: null
    }))
  ]

  return { clusters, standalones }
}

/** Per-facility drill-down: competitors/referral hospitals within radius of one anchor, excluding the portfolio itself. */
export function findFacilityMarket(
  anchor: PortfolioMemberResolved,
  portfolioMembers: PortfolioMemberResolved[],
  snfs: SnfRecord[],
  hospitals: HospitalRecord[],
  competitorRadiusMiles: number
): { competitors: MarketFacility[]; referralHospitals: MarketFacility[] } {
  const memberSnfCcns = new Set(portfolioMembers.filter((m) => m.facility.kind === 'snf').map((m) => m.facility.ccn))
  const memberHospitalCcns = new Set(portfolioMembers.filter((m) => m.facility.kind === 'hospital').map((m) => m.facility.ccn))
  return {
    competitors: findMarketFacilities([anchor], snfs, 'snf', memberSnfCcns, competitorRadiusMiles),
    referralHospitals: findMarketFacilities([anchor], hospitals, 'hospital', memberHospitalCcns, competitorRadiusMiles)
  }
}

export { memberId as portfolioMemberId }
