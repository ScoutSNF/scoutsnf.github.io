import { useState, type ReactNode } from 'react'

/** Renders up to `cap` items, with a "show all (N)" button to reveal the rest. */
export function CappedList<T>({
  items,
  cap,
  keyFor,
  renderItem,
  emptyLabel
}: {
  items: T[]
  cap: number
  keyFor: (item: T) => string
  renderItem: (item: T) => ReactNode
  emptyLabel: string
}) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) {
    return <p className="px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400">{emptyLabel}</p>
  }

  const visible = expanded ? items : items.slice(0, cap)

  return (
    <div>
      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
        {visible.map((item) => (
          <div key={keyFor(item)}>{renderItem(item)}</div>
        ))}
      </div>
      {!expanded && items.length > cap && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 px-2 text-xs text-sky-600 hover:underline dark:text-sky-400"
        >
          Show all ({items.length})
        </button>
      )}
    </div>
  )
}
