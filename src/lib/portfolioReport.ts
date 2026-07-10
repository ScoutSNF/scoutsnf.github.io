import type { FacilityRecord, SnfRecord, HospitalRecord } from '../types/facility'
import type { SavedFacilityRow } from '../data/db'
import { withinRadius } from './market'
import { haversineMiles, roundMile } from './geo'

export interface PortfolioMemberResolved {
  row: SavedFacilityRow
  facility: FacilityRecord
}

export interface PortfolioDistance {
  a: PortfolioMemberResolved
  b: PortfolioMemberResolved
  distanceMiles: number
}

export interface SharedCompetitorNear {
  member: PortfolioMemberResolved
  distanceMiles: number
}

export interface SharedCompetitor {
  facility: SnfRecord
  near: SharedCompetitorNear[]
}

export interface PortfolioReportData {
  members: PortfolioMemberResolved[]
  distances: PortfolioDistance[]
  competitorsByMemberId: Map<string, { facility: SnfRecord; distanceMiles: number }[]>
  sharedCompetitors: SharedCompetitor[]
  uniqueCompetitorCount: number
  statesCovered: string[]
}

export function resolvePortfolioMembers(
  memberIds: string[],
  saved: SavedFacilityRow[],
  snfs: SnfRecord[],
  hospitals: HospitalRecord[]
): PortfolioMemberResolved[] {
  const members: PortfolioMemberResolved[] = []
  for (const id of memberIds) {
    const row = saved.find((s) => s.id === id)
    if (!row) continue
    const facility: FacilityRecord | undefined =
      row.kind === 'snf' ? snfs.find((s) => s.ccn === row.ccn) : hospitals.find((h) => h.ccn === row.ccn)
    if (facility) members.push({ row, facility })
  }
  return members
}

export function buildPortfolioReport(members: PortfolioMemberResolved[], snfs: SnfRecord[]): PortfolioReportData {
  const memberSnfCcns = new Set(members.filter((m) => m.facility.kind === 'snf').map((m) => m.facility.ccn))

  const distances: PortfolioDistance[] = []
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i]
      const b = members[j]
      if (a.facility.latitude == null || a.facility.longitude == null) continue
      if (b.facility.latitude == null || b.facility.longitude == null) continue
      const distanceMiles = roundMile(
        haversineMiles(a.facility.latitude, a.facility.longitude, b.facility.latitude, b.facility.longitude)
      )
      distances.push({ a, b, distanceMiles })
    }
  }
  distances.sort((x, y) => x.distanceMiles - y.distanceMiles)

  const competitorsByMemberId = new Map<string, { facility: SnfRecord; distanceMiles: number }[]>()
  const competitorHits = new Map<string, SharedCompetitor>()

  for (const member of members) {
    const memberId = `${member.facility.kind}:${member.facility.ccn}`
    if (member.facility.latitude == null || member.facility.longitude == null) {
      competitorsByMemberId.set(memberId, [])
      continue
    }
    const nearby = withinRadius(
      { latitude: member.facility.latitude, longitude: member.facility.longitude },
      snfs,
      member.row.radiusMiles,
      member.facility.kind === 'snf' ? member.facility.ccn : undefined
    ).filter((r) => !memberSnfCcns.has(r.facility.ccn))

    competitorsByMemberId.set(
      memberId,
      nearby.map((r) => ({ facility: r.facility, distanceMiles: r.distanceMiles }))
    )

    for (const r of nearby) {
      const entry = competitorHits.get(r.facility.ccn) ?? { facility: r.facility, near: [] }
      entry.near.push({ member, distanceMiles: r.distanceMiles })
      competitorHits.set(r.facility.ccn, entry)
    }
  }

  const sharedCompetitors = [...competitorHits.values()]
    .filter((c) => c.near.length >= 2)
    .sort((x, y) => {
      if (y.near.length !== x.near.length) return y.near.length - x.near.length
      return Math.min(...x.near.map((n) => n.distanceMiles)) - Math.min(...y.near.map((n) => n.distanceMiles))
    })

  const statesCovered = [...new Set(members.map((m) => m.facility.state).filter((s): s is string => Boolean(s)))]

  return {
    members,
    distances,
    competitorsByMemberId,
    sharedCompetitors,
    uniqueCompetitorCount: competitorHits.size,
    statesCovered
  }
}
