import type { StandaloneFacility } from '../lib/portfolioClusters'
import { PortfolioMemberRow } from './PortfolioMemberRow'
import { titleCaseName } from '../lib/facilityDisplay'

export function StandaloneRow({
  standalone,
  onClick
}: {
  standalone: StandaloneFacility
  onClick: () => void
}) {
  const badge = !standalone.hasLocation ? (
    <span className="shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      No location data
    </span>
  ) : undefined

  return (
    <div>
      <PortfolioMemberRow member={standalone.member} onClick={onClick} badge={badge} />
      {standalone.hasLocation && standalone.nearestPortfolioMember && (
        <p className="-mt-1 pb-1.5 text-xs text-slate-500 dark:text-slate-400">
          Nearest portfolio facility: {titleCaseName(standalone.nearestPortfolioMember.row.name)}, {standalone.nearestPortfolioMiles} mi
        </p>
      )}
    </div>
  )
}
