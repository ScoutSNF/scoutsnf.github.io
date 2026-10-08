import { useMemo, useState } from 'react'
import type { SnfRecord, HospitalRecord, FacilityRecord } from '../types/facility'
import type { PortfolioMemberResolved, PortfolioDistance } from '../lib/portfolioReport'
import type { Cluster } from '../lib/portfolioClusters'
import { findFacilityMarket, portfolioMemberId } from '../lib/portfolioClusters'
import { PortfolioMemberRow } from './PortfolioMemberRow'
import { MarketFacilityRow } from './MarketFacilityRow'
import { CappedList } from './CappedList'
import { CompareCard } from './CompareCard'
import { titleCaseName } from '../lib/facilityDisplay'

const FAR_DISTANCE_MILES = 50

interface DistanceRow {
  member: PortfolioMemberResolved
  distanceMiles: number
  sameCluster: boolean
}

function useAnchorDistances(
  anchor: PortfolioMemberResolved,
  members: PortfolioMemberResolved[],
  distances: PortfolioDistance[],
  clusterByMemberId: Map<string, Cluster>
): { near: DistanceRow[]; far: DistanceRow[] } {
  return useMemo(() => {
    const anchorId = portfolioMemberId(anchor)
    const anchorCluster = clusterByMemberId.get(anchorId)
    const rows: DistanceRow[] = []
    for (const m of members) {
      const mId = portfolioMemberId(m)
      if (mId === anchorId) continue
      const d = distances.find((d) => {
        const aId = portfolioMemberId(d.a)
        const bId = portfolioMemberId(d.b)
        return (aId === anchorId && bId === mId) || (bId === anchorId && aId === mId)
      })
      if (!d) continue
      const sameCluster = anchorCluster != null && clusterByMemberId.get(mId)?.id === anchorCluster.id
      rows.push({ member: m, distanceMiles: d.distanceMiles, sameCluster })
    }
    rows.sort((a, b) => {
      if (a.sameCluster !== b.sameCluster) return a.sameCluster ? -1 : 1
      return a.distanceMiles - b.distanceMiles
    })
    const near = rows.filter((r) => r.sameCluster || r.distanceMiles <= FAR_DISTANCE_MILES)
    const far = rows.filter((r) => !r.sameCluster && r.distanceMiles > FAR_DISTANCE_MILES)
    return { near, far }
  }, [anchor, members, distances, clusterByMemberId])
}

export function PortfolioAnchorDrillDown({
  anchor,
  members,
  distances,
  clusterByMemberId,
  snfs,
  hospitals,
  competitorRadiusMiles,
  savedIds,
  onToggleSave,
  onSelectFacility,
  onBack,
  showBack = true
}: {
  anchor: PortfolioMemberResolved
  members: PortfolioMemberResolved[]
  distances: PortfolioDistance[]
  clusterByMemberId: Map<string, Cluster>
  snfs: SnfRecord[]
  hospitals: HospitalRecord[]
  competitorRadiusMiles: number
  savedIds: Set<string>
  onToggleSave: (facility: FacilityRecord) => void
  onSelectFacility: (member: PortfolioMemberResolved) => void
  onBack: () => void
  showBack?: boolean
}) {
  const [showFar, setShowFar] = useState(false)
  const [compareTarget, setCompareTarget] = useState<{ facility: FacilityRecord; distanceMiles: number } | null>(null)

  const { near, far } = useAnchorDistances(anchor, members, distances, clusterByMemberId)
  const market = useMemo(
    () => findFacilityMarket(anchor, members, snfs, hospitals, competitorRadiusMiles),
    [anchor, members, snfs, hospitals, competitorRadiusMiles]
  )

  const anchorCluster = clusterByMemberId.get(portfolioMemberId(anchor)) ?? null

  return (
    <div className="flex flex-col gap-4">
      {showBack && (
        <div className="flex items-center justify-between gap-2">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-brand dark:text-slate-400">
            ← Back
          </button>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <PortfolioMemberRow member={anchor} />
        {anchorCluster && (
          <p className="text-xs text-slate-500 dark:text-slate-400">Part of the {anchorCluster.name} cluster.</p>
        )}
      </section>

      {compareTarget && (
        <CompareCard
          anchor={anchor.facility}
          facility={compareTarget.facility}
          distanceMiles={compareTarget.distanceMiles}
          savedIds={savedIds}
          onToggleSave={onToggleSave}
          onClose={() => setCompareTarget(null)}
        />
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold">Portfolio distances</h3>
        {near.length === 0 && far.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {members.length <= 1 ? 'No other facilities in this portfolio.' : 'No other portfolio facilities have location data.'}
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {[...near, ...(showFar ? far : [])].map((row) => (
              <div key={row.member.row.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelectFacility(row.member)}
                >
                  <span className="font-medium">{titleCaseName(row.member.row.name)}</span>
                  {row.sameCluster && (
                    <span className="ml-2 rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand">
                      {clusterByMemberId.get(portfolioMemberId(row.member))?.name}
                    </span>
                  )}
                </button>
                <span className="shrink-0 font-medium">{row.distanceMiles} mi</span>
              </div>
            ))}
          </div>
        )}
        {!showFar && far.length > 0 && (
          <button
            onClick={() => setShowFar(true)}
            className="mt-1 text-xs text-sky-600 hover:underline dark:text-sky-400"
          >
            Show all ({far.length} more over {FAR_DISTANCE_MILES} mi)
          </button>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold">Competitors near this facility ({market.competitors.length})</h3>
        <CappedList
          items={market.competitors}
          cap={10}
          keyFor={(c) => c.ccn}
          renderItem={(c) => (
            <MarketFacilityRow
              item={c}
              onClick={() => setCompareTarget({ facility: c.facility, distanceMiles: c.nearestMemberMiles })}
            />
          )}
          emptyLabel="No competing SNFs nearby."
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-2 text-sm font-semibold">Referral hospitals near this facility ({market.referralHospitals.length})</h3>
        <CappedList
          items={market.referralHospitals}
          cap={10}
          keyFor={(h) => h.ccn}
          renderItem={(h) => <MarketFacilityRow item={h} />}
          emptyLabel="No hospitals nearby."
        />
      </section>
    </div>
  )
}
