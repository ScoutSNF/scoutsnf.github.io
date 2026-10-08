import type { ReactNode } from 'react'
import type { PortfolioMemberResolved } from '../lib/portfolioReport'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { titleCaseName, getBedsDisplay, getOccupancyDisplay } from '../lib/facilityDisplay'

export function PortfolioMemberRow({
  member,
  onClick,
  trailing,
  badge
}: {
  member: PortfolioMemberResolved
  onClick?: () => void
  trailing?: ReactNode
  badge?: ReactNode
}) {
  const occ = getOccupancyDisplay(member.facility)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <button
        className="min-w-0 flex-1 text-left disabled:cursor-default"
        onClick={onClick}
        disabled={!onClick}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{titleCaseName(member.row.name)}</span>
          <TypeBadge facility={member.facility} />
          {badge}
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {member.row.city}, {member.row.state}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
        <span>{getBedsDisplay(member.facility)} beds</span>
        <span>{occ.text} occ</span>
        <StarRating rating={member.facility.overallRating} />
        {trailing}
      </div>
    </div>
  )
}
