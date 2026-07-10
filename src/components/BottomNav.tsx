import { BookmarkIcon } from './BookmarkIcon'

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

export function BottomNav({
  view,
  onChangeView,
  savedCount
}: {
  view: 'board' | 'search'
  onChangeView: (view: 'board' | 'search') => void
  savedCount: number
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        onClick={() => onChangeView('board')}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
          view === 'board' ? 'text-brand' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        <BookmarkIcon filled={view === 'board'} className="text-lg" />
        ScoutBoard{savedCount > 0 ? ` (${savedCount})` : ''}
      </button>
      <button
        onClick={() => onChangeView('search')}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
          view === 'search' ? 'text-brand' : 'text-slate-400 dark:text-slate-500'
        }`}
      >
        <SearchIcon className="text-lg" />
        Search
      </button>
    </nav>
  )
}
