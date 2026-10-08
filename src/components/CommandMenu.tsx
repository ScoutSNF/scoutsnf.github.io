import { useEffect, useMemo, useRef, useState } from 'react'
import type { FacilityRecord, SnfRecord, HospitalRecord } from '../types/facility'
import { searchFacilities } from '../lib/search'
import { titleCaseName } from '../lib/facilityDisplay'
import type { AppView } from '../lib/routing'

export interface CommandAction {
  id: string
  label: string
  hint?: string
  run: () => void
}

/** Platform-correct modifier label, so the hint matches the key people actually press. */
export const MOD_KEY =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

/**
 * Command menu: facility search and navigation from the keyboard.
 *
 * Opens on Cmd/Ctrl+K. Deliberately the only global shortcut that fires while an input has focus —
 * every other binding here is scoped to the open dialog, so typing a facility name into the search
 * box can never trigger navigation. Single-letter global shortcuts are not used at all for the
 * same reason.
 *
 * Focus is trapped while open and restored to whatever had it when the dialog closes.
 */
export function CommandMenu({
  open,
  onOpenChange,
  snfs,
  hospitals,
  onSelectFacility,
  onNavigate,
  extraActions = []
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  snfs: SnfRecord[]
  hospitals: HospitalRecord[]
  onSelectFacility: (facility: FacilityRecord) => void
  onNavigate: (view: AppView) => void
  extraActions?: CommandAction[]
}) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  const navActions: CommandAction[] = useMemo(
    () => [
      { id: 'go-search', label: 'Go to Search', hint: 'Navigation', run: () => onNavigate('search') },
      { id: 'go-board', label: 'Go to ScoutBoard', hint: 'Navigation', run: () => onNavigate('board') },
      { id: 'go-legend', label: 'Go to Sources & definitions', hint: 'Navigation', run: () => onNavigate('legend') },
      { id: 'go-settings', label: 'Go to Settings', hint: 'Navigation', run: () => onNavigate('settings') }
    ],
    [onNavigate]
  )

  const facilityHits = useMemo(() => {
    if (query.trim().length < 2) return []
    return searchFacilities(query, snfs, hospitals, {}, 8).hits.map((h) => h.facility)
  }, [query, snfs, hospitals])

  const actions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = [...extraActions, ...navActions]
    return q.length === 0 ? all : all.filter((a) => a.label.toLowerCase().includes(q))
  }, [query, extraActions, navActions])

  const rows = useMemo(
    () => [
      ...facilityHits.map((f) => ({ kind: 'facility' as const, facility: f })),
      ...actions.map((a) => ({ kind: 'action' as const, action: a }))
    ],
    [facilityHits, actions]
  )

  useEffect(() => setIndex(0), [query, open])

  useEffect(() => {
    if (!open) return
    restoreTo.current = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => {
      // Focus goes back where it came from, so keyboard users are not dropped at the top of the
      // document every time they dismiss the menu.
      restoreTo.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  function choose(i: number) {
    const row = rows[i]
    if (!row) return
    if (row.kind === 'facility') onSelectFacility(row.facility)
    else row.action.run()
    onOpenChange(false)
    setQuery('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-[--radius-lg] border border-[--color-border] bg-[--color-surface] shadow-[--shadow-pop]"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search facilities, or jump to a page…"
          aria-label="Search facilities or commands"
          className="w-full border-b border-[--color-border] bg-transparent px-4 py-3 text-base text-[--color-text] outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, rows.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(index)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onOpenChange(false)
            }
          }}
        />

        <ul role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto">
          {rows.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-[--color-text-secondary]">
              {query.trim().length >= 2 ? `Nothing matches “${query.trim()}”` : 'Type to search facilities or pages'}
            </li>
          )}
          {rows.map((row, i) => {
            const selected = i === index
            const key = row.kind === 'facility' ? `f:${row.facility.kind}:${row.facility.ccn}` : `a:${row.action.id}`
            return (
              <li key={key} role="option" aria-selected={selected}>
                <button
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(i)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${
                    selected ? 'bg-[--color-brand-subtle]' : ''
                  }`}
                >
                  {row.kind === 'facility' ? (
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-[--color-text]">
                        {titleCaseName(row.facility.name)}
                      </span>
                      <span className="block truncate text-xs text-[--color-text-secondary]">
                        {row.facility.city}, {row.facility.state} · CCN {row.facility.ccn}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-[--color-text]">{row.action.label}</span>
                  )}
                  <span className="shrink-0 text-xs text-[--color-text-muted]">
                    {row.kind === 'facility' ? 'Facility' : row.action.hint}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[--color-border] px-4 py-2 text-xs text-[--color-text-muted]">
          <span><kbd className="font-sans font-semibold">↑</kbd> <kbd className="font-sans font-semibold">↓</kbd> navigate</span>
          <span><kbd className="font-sans font-semibold">Enter</kbd> open</span>
          <span><kbd className="font-sans font-semibold">Esc</kbd> close</span>
          <span className="ml-auto"><kbd className="font-sans font-semibold">{MOD_KEY}</kbd>+<kbd className="font-sans font-semibold">K</kbd> anywhere</span>
        </div>
      </div>
    </div>
  )
}
