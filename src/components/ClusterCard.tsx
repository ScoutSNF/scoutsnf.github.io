import type { Cluster } from '../lib/portfolioClusters'
import type { PortfolioMemberResolved } from '../lib/portfolioReport'
import { PortfolioMemberRow } from './PortfolioMemberRow'
import { MarketFacilityRow } from './MarketFacilityRow'
import { CappedList } from './CappedList'
import { titleCaseName } from '../lib/facilityDisplay'

export function ClusterCard({
  cluster,
  onSelectFacility
}: {
  cluster: Cluster
  onSelectFacility: (member: PortfolioMemberResolved) => void
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-sm font-semibold">{cluster.name}</h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {cluster.members.length} facilities · {cluster.totalBeds} beds
          {cluster.weightedOccupancy != null && ` · ${cluster.weightedOccupancy}% avg occ`}
        </span>
      </div>

      {cluster.cannibalizationPairs.map((p) => (
        <div
          key={`${p.memberA.facility.ccn}-${p.memberB.facility.ccn}`}
          className="mb-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        >
          ⚠ {titleCaseName(p.memberA.row.name)} and {titleCaseName(p.memberB.row.name)} are {p.miles} mi apart — direct market overlap.
        </div>
      ))}

      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
        {cluster.members.map((m) => (
          <PortfolioMemberRow key={m.row.id} member={m} onClick={() => onSelectFacility(m)} />
        ))}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Market intruders ({cluster.intruders.length})
        </h4>
        <CappedList
          items={cluster.intruders}
          cap={5}
          keyFor={(i) => i.ccn}
          renderItem={(i) => <MarketFacilityRow item={i} />}
          emptyLabel="No competing SNFs nearby."
        />
      </div>

      <div className="mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Referral hospitals ({cluster.referralHospitals.length})
        </h4>
        <CappedList
          items={cluster.referralHospitals}
          cap={5}
          keyFor={(h) => h.ccn}
          renderItem={(h) => <MarketFacilityRow item={h} />}
          emptyLabel="No hospitals nearby."
        />
      </div>
    </section>
  )
}
