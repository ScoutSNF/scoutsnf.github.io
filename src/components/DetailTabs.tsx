import { useId, useRef, type ReactNode } from 'react'

export interface DetailTab {
  id: string
  label: string
  content: ReactNode
  /** Rendered next to the label, e.g. a count or a "no data" marker. */
  hint?: string
}

/**
 * Accessible tabs for the facility detail sections.
 *
 * Follows the ARIA tabs pattern properly rather than styling a row of buttons: roving tabindex,
 * Left/Right/Home/End keys, and `aria-controls` tying each tab to its panel. Panels are kept
 * mounted and hidden rather than unmounted, so switching back to Financials does not lose chart
 * tooltips, expanded rows or scroll position — "preserve research context when switching".
 */
export function DetailTabs({
  tabs,
  active,
  onChange,
  className = ''
}: {
  tabs: DetailTab[]
  active: string
  onChange: (id: string) => void
  className?: string
}) {
  const baseId = useId()
  const listRef = useRef<HTMLDivElement | null>(null)

  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === active)
    let next = i
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    else return
    e.preventDefault()
    onChange(tabs[next].id)
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        aria-label="Facility detail sections"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-[--color-border]"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`-mb-px min-h-[2.75rem] whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? 'border-[--color-brand] text-[--color-text]'
                  : 'border-transparent text-[--color-text-secondary] hover:text-[--color-text]'
              }`}
            >
              {tab.label}
              {tab.hint && <span className="ml-1.5 text-xs font-normal text-[--color-text-muted]">{tab.hint}</span>}
            </button>
          )
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className="pt-3 focus-visible:outline-none"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
