import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

export interface PortfolioNavItem {
  id: string
  name: string
  count: number
}

/** The admin options pinned to the bottom. Search and ScoutBoard are rendered separately above. */
const ADMIN_ITEMS: { view: AppView; label: string; icon: (p: { className?: string }) => ReactNode }[] = [
  { view: 'legend', label: 'Sources', icon: BookIcon },
  { view: 'settings', label: 'Settings', icon: GearIcon }
]

export interface NavProps {
  view: AppView
  /** Which portfolio's landing page is open, so that row -- not ScoutBoard -- reads as selected. */
  portfolioId: string | null
  savedCount: number
  portfolios: PortfolioNavItem[]
  /** Saved facilities in no portfolio. The Unfiled row is hidden entirely when this is 0. */
  unfiledCount: number
  /** ScoutBoard is a disclosure, not a destination: this is its open/closed state. */
  boardOpen: boolean
  onToggleBoard: () => void
  onNavigate: (view: AppView) => void
  onOpenPortfolio: (id: string) => void
  onNewPortfolio: (name: string) => void
}

/** The "+ New portfolio" action and the inline name field it opens into. */
function NewPortfolio({ onCreate, touch = false }: { onCreate: (name: string) => void; touch?: boolean }) {
  const [composing, setComposing] = useState(false)
  const [name, setName] = useState('')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate(trimmed)
    setName('')
    setComposing(false)
  }

  const height = touch ? 'min-h-[2.75rem]' : ''

  if (!composing) {
    return (
      <button
        onClick={() => setComposing(true)}
        className={`flex w-full items-center rounded-[--radius-md] px-2 py-1.5 text-left text-xs font-medium text-[--color-brand-strong] hover:bg-[--color-surface-hover] ${height}`}
      >
        + New portfolio
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setName('')
            setComposing(false)
          }
        }}
        onBlur={() => {
          if (!name.trim()) setComposing(false)
        }}
        aria-label="New portfolio name"
        placeholder="Portfolio name"
        className={`w-full min-w-0 rounded-[--radius-sm] border border-[--color-border-strong] bg-[--color-surface] px-2 py-1 text-xs text-[--color-text] ${height}`}
      />
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={submit}
        className={`shrink-0 rounded-[--radius-sm] bg-[--color-brand] px-2 py-1 text-xs font-medium text-[--color-brand-contrast] ${height}`}
      >
        Add
      </button>
    </div>
  )
}

/**
 * Persistent navigation.
 *
 * A rail on desktop so the 1440px workspace is not spent on a centred column, and a bottom bar on
 * phones where thumbs are. Both expose the same destinations, so a view can never be reachable
 * from one and stranded in the other -- which is how the Legend page ended up stranded before.
 *
 * ScoutBoard is a disclosure rather than a link: it has no page of its own any more, so tapping it
 * opens the portfolio list instead of navigating. Sources and Settings are pinned to the bottom,
 * separated and quieter, because they are consulted rather than worked in.
 */
export function SideNav(props: NavProps) {
  const { view, portfolioId, savedCount, boardOpen, onNavigate } = props
  // Opening ScoutBoard does not navigate, so the page underneath is still the current one. Only
  // one thing may read as selected at a time, and while the list is open with nothing picked under
  // it, that is ScoutBoard -- otherwise Search and ScoutBoard both light up and neither means much.
  const boardSelected = boardOpen && view !== 'portfolio' && view !== 'unfiled'

  return (
    <nav
      aria-label="Main"
      // Sticky and exactly one viewport tall. Without the fixed height the rail grows with the
      // document, and `mt-auto` then pins Sources/Settings to the bottom of a very long page --
      // off screen -- instead of to the bottom of the rail.
      className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-[--color-border] lg:bg-[--color-surface] lg:p-3"
    >
      <div className="flex flex-col gap-1">
        <NavButton
          icon={<SearchIcon className="text-base" />}
          label="Search"
          active={view === 'search' && !boardSelected}
          onClick={() => onNavigate('search')}
        />

        <BoardDisclosure {...props} savedCount={savedCount} boardOpen={boardOpen} portfolioId={portfolioId} />
      </div>

      {/* Pinned to the bottom: mt-auto pushes this block down however tall the portfolio list gets. */}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-[--color-border] pt-2">
        {ADMIN_ITEMS.map((item) => {
          const active = view === item.view && !boardSelected
          const Icon = item.icon
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2.5 rounded-[--radius-md] px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-[--color-brand-subtle] text-[--color-brand-strong]'
                  : 'text-[--color-text-muted] hover:bg-[--color-surface-hover] hover:text-[--color-text-secondary]'
              }`}
            >
              <Icon className="text-sm" />
              <span className="flex-1 text-left">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

function NavButton({
  icon,
  label,
  active,
  onClick,
  badge
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-[--radius-md] px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-[--color-brand-subtle] text-[--color-brand-strong]'
          : 'text-[--color-text-secondary] hover:bg-[--color-surface-hover] hover:text-[--color-text]'
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className="rounded-[--radius-pill] bg-[--color-surface-sunken] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[--color-text-secondary]">
          {badge}
        </span>
      )}
    </button>
  )
}

/**
 * ScoutBoard and its portfolio list.
 *
 * ScoutBoard reads as selected while the list is open and nothing under it has been picked; once a
 * portfolio is open, that row takes the selection and ScoutBoard keeps only the open chevron. It is
 * a button with aria-expanded rather than a link, because it goes nowhere.
 */
function BoardDisclosure({
  portfolioId,
  savedCount,
  portfolios,
  unfiledCount,
  boardOpen,
  view,
  onToggleBoard,
  onNavigate,
  onOpenPortfolio,
  onNewPortfolio
}: NavProps) {
  const childSelected = view === 'portfolio' || view === 'unfiled'

  return (
    <div className="flex flex-col">
      <button
        onClick={onToggleBoard}
        aria-expanded={boardOpen}
        aria-controls="scoutboard-portfolios"
        className={`flex items-center gap-2.5 rounded-[--radius-md] px-3 py-2 text-sm font-medium transition-colors ${
          boardOpen && !childSelected
            ? 'bg-[--color-brand-subtle] text-[--color-brand-strong]'
            : 'text-[--color-text-secondary] hover:bg-[--color-surface-hover] hover:text-[--color-text]'
        }`}
      >
        <BookmarkIcon filled={false} className="text-base" />
        <span className="flex-1 text-left">ScoutBoard</span>
        {savedCount > 0 && (
          <span className="rounded-[--radius-pill] bg-[--color-surface-sunken] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[--color-text-secondary]">
            {savedCount}
          </span>
        )}
        <ChevronIcon className={`text-xs transition-transform ${boardOpen ? 'rotate-90' : ''}`} />
      </button>

      {boardOpen && (
        <ul id="scoutboard-portfolios" className="mt-0.5 flex flex-col gap-0.5 border-l border-[--color-border] pl-2 ml-5">
          {portfolios.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-[--color-text-muted]">No portfolios yet</li>
          )}
          {portfolios.map((p) => {
            const active = view === 'portfolio' && portfolioId === p.id
            return (
              <li key={p.id}>
                <button
                  onClick={() => onOpenPortfolio(p.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center gap-2 rounded-[--radius-md] px-2 py-1.5 text-left text-sm transition-colors ${
                    active
                      ? 'bg-[--color-brand-subtle] font-medium text-[--color-brand-strong]'
                      : 'text-[--color-text-secondary] hover:bg-[--color-surface-hover] hover:text-[--color-text]'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[--color-text-muted]">{p.count}</span>
                </button>
              </li>
            )
          })}

          <li>
            <NewPortfolio onCreate={onNewPortfolio} />
          </li>

          {unfiledCount > 0 && (
            <li>
              <button
                onClick={() => onNavigate('unfiled')}
                aria-current={view === 'unfiled' ? 'page' : undefined}
                className={`flex w-full items-center gap-2 rounded-[--radius-md] px-2 py-1.5 text-left text-sm transition-colors ${
                  view === 'unfiled'
                    ? 'bg-[--color-brand-subtle] font-medium text-[--color-brand-strong]'
                    : 'text-[--color-text-secondary] hover:bg-[--color-surface-hover] hover:text-[--color-text]'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">Unfiled</span>
                <span className="shrink-0 text-xs tabular-nums text-[--color-text-muted]">{unfiledCount}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

/**
 * Phone navigation.
 *
 * The bar itself stays a bar -- Search has to remain one thumb-tap away, so it is never pushed off
 * screen by the portfolio list. ScoutBoard instead raises a drawer that sits directly on top of the
 * bar, leaving Search visible beneath it, and every row in it is a 44px target.
 */
export function MobileNav(props: NavProps) {
  const {
    view,
    portfolioId,
    savedCount,
    portfolios,
    unfiledCount,
    boardOpen,
    onToggleBoard,
    onNavigate,
    onOpenPortfolio,
    onNewPortfolio
  } = props

  const drawerRef = useRef<HTMLDivElement | null>(null)
  const [barHeight, setBarHeight] = useState(0)
  const barRef = useRef<HTMLDivElement | null>(null)

  // The drawer is positioned above the bar rather than over it, so Search stays visible and
  // tappable while the portfolio list is open. Measured rather than hard-coded because the bar's
  // height includes the safe-area inset, which differs per device.
  useEffect(() => {
    if (!barRef.current) return
    const measure = () => setBarHeight(barRef.current?.offsetHeight ?? 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [boardOpen])

  useEffect(() => {
    if (!boardOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onToggleBoard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [boardOpen, onToggleBoard])

  const childSelected = view === 'portfolio' || view === 'unfiled'
  // Same single-selection rule as the desktop rail: while the drawer is open with nothing picked,
  // ScoutBoard is the selected tab and the page underneath does not also light up.
  const boardSelected = boardOpen && !childSelected

  return (
    <>
      {boardOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={onToggleBoard} aria-hidden="true" />
          <div
            ref={drawerRef}
            id="scoutboard-portfolios-mobile"
            role="group"
            aria-label="Portfolios"
            className="fixed inset-x-0 z-40 max-h-[60vh] overflow-y-auto border-t border-[--color-border] bg-[--color-surface] px-2 py-2 shadow-[--shadow-pop] lg:hidden"
            style={{ bottom: barHeight }}
          >
            {portfolios.length === 0 && (
              <p className="px-3 py-2 text-sm text-[--color-text-muted]">No portfolios yet</p>
            )}
            {portfolios.map((p) => {
              const active = view === 'portfolio' && portfolioId === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => onOpenPortfolio(p.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-[2.75rem] w-full items-center gap-2 rounded-[--radius-md] px-3 text-left text-sm ${
                    active ? 'bg-[--color-brand-subtle] font-medium text-[--color-brand-strong]' : 'text-[--color-text]'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[--color-text-muted]">{p.count}</span>
                </button>
              )
            })}

            <NewPortfolio onCreate={onNewPortfolio} touch />

            {unfiledCount > 0 && (
              <button
                onClick={() => onNavigate('unfiled')}
                aria-current={view === 'unfiled' ? 'page' : undefined}
                className={`flex min-h-[2.75rem] w-full items-center gap-2 rounded-[--radius-md] px-3 text-left text-sm ${
                  view === 'unfiled'
                    ? 'bg-[--color-brand-subtle] font-medium text-[--color-brand-strong]'
                    : 'text-[--color-text]'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">Unfiled</span>
                <span className="shrink-0 text-xs tabular-nums text-[--color-text-muted]">{unfiledCount}</span>
              </button>
            )}
          </div>
        </>
      )}

      <nav
        ref={barRef}
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[--color-border] bg-[--color-surface] lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <MobileTab
          icon={<SearchIcon className="text-lg" />}
          label="Search"
          active={view === 'search' && !boardSelected}
          onClick={() => onNavigate('search')}
        />
        <MobileTab
          icon={<BookmarkIcon filled={false} className="text-lg" />}
          label={savedCount > 0 ? `ScoutBoard (${savedCount})` : 'ScoutBoard'}
          active={boardSelected || childSelected}
          onClick={onToggleBoard}
          expanded={boardOpen}
          controls="scoutboard-portfolios-mobile"
        />
        {ADMIN_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <MobileTab
              key={item.view}
              icon={<Icon className="text-lg" />}
              label={item.label}
              active={view === item.view && !boardSelected}
              onClick={() => onNavigate(item.view)}
              muted
            />
          )
        })}
      </nav>
    </>
  )
}

function MobileTab({
  icon,
  label,
  active,
  onClick,
  muted = false,
  expanded,
  controls
}: {
  icon: ReactNode
  label: string
  active: boolean
  onClick: () => void
  muted?: boolean
  expanded?: boolean
  controls?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-expanded={expanded}
      aria-controls={controls}
      // 44px minimum touch target.
      className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium ${
        active ? 'text-[--color-brand-strong]' : muted ? 'text-[--color-text-muted]' : 'text-[--color-text-secondary]'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}
