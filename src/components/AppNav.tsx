import type { ReactNode } from 'react'
import type { AppView } from '../lib/routing'
import { BookmarkIcon } from './BookmarkIcon'

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export interface NavItem {
  view: AppView
  label: string
  icon: (p: { className?: string }) => ReactNode
  badge?: number
}

export const NAV_ITEMS: NavItem[] = [
  { view: 'search', label: 'Search', icon: SearchIcon },
  { view: 'board', label: 'ScoutBoard', icon: (p) => <BookmarkIcon filled={false} {...p} /> },
  { view: 'legend', label: 'Sources', icon: BookIcon },
  { view: 'settings', label: 'Settings', icon: GearIcon }
]

/**
 * Persistent navigation.
 *
 * A rail on desktop so the 1440px workspace is not spent on a centred column, and the existing
 * bottom bar on phones where thumbs are. Both render the same item list, so a view can never be
 * reachable from one and not the other -- which is how the Legend page ended up stranded before.
 *
 * Every destination carries a visible text label at both sizes: icon-only navigation makes people
 * guess, and this is a tool people use occasionally rather than daily.
 */
export function SideNav({
  view,
  savedCount,
  onNavigate
}: {
  view: AppView
  savedCount: number
  onNavigate: (view: AppView) => void
}) {
  return (
    <nav
      aria-label="Main"
      className="hidden lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:gap-1 lg:border-r lg:border-[--color-border] lg:bg-[--color-surface] lg:p-3"
    >
      {NAV_ITEMS.map((item) => {
        const active = view === item.view || (item.view === 'board' && view === 'portfolio')
        const Icon = item.icon
        return (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-[--radius-md] px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-[--color-brand-subtle] text-[--color-brand-strong]'
                : 'text-[--color-text-secondary] hover:bg-[--color-surface-hover] hover:text-[--color-text]'
            }`}
          >
            <Icon className="text-base" />
            <span className="flex-1 text-left">{item.label}</span>
            {item.view === 'board' && savedCount > 0 && (
              <span className="rounded-[--radius-pill] bg-[--color-surface-sunken] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[--color-text-secondary]">
                {savedCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

export function MobileNav({
  view,
  savedCount,
  onNavigate
}: {
  view: AppView
  savedCount: number
  onNavigate: (view: AppView) => void
}) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[--color-border] bg-[--color-surface] lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map((item) => {
        const active = view === item.view || (item.view === 'board' && view === 'portfolio')
        const Icon = item.icon
        return (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            aria-current={active ? 'page' : undefined}
            // 44px minimum touch target.
            className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium ${
              active ? 'text-[--color-brand-strong]' : 'text-[--color-text-muted]'
            }`}
          >
            <Icon className="text-lg" />
            <span>
              {item.label}
              {item.view === 'board' && savedCount > 0 ? ` (${savedCount})` : ''}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
