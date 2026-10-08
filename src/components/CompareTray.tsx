import { useState } from 'react'
import type { FacilityRecord } from '../types/facility'
import type { FacilityYearRecord } from '../types/costReport'
import { titleCaseName } from '../lib/facilityDisplay'
import { CompareTable, MAX_COMPARE, type CompareEntry } from './CompareTable'

/**
 * Persistent tray holding the facilities selected for comparison.
 *
 * Docked above the mobile nav and along the bottom on desktop, so a selection made while browsing
 * one market survives navigating to another — picking four facilities to compare is the whole
 * point, and a selection that resets on navigation cannot do it.
 *
 * Collapsed to a summary bar until opened, so it never covers the results it was filled from.
 */
export function CompareTray({
  selected,
  costReportsByCcn,
  onRemove,
  onClear
}: {
  selected: FacilityRecord[]
  costReportsByCcn: Map<string, FacilityYearRecord[]>
  onRemove: (facility: FacilityRecord) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  if (selected.length === 0) return null

  const entries: CompareEntry[] = selected.map((facility) => ({
    facility,
    records: costReportsByCcn.get(facility.ccn)
  }))

  return (
    <div className="fixed inset-x-0 bottom-[3.25rem] z-30 border-t border-[--color-border] bg-[--color-surface] shadow-[--shadow-pop] lg:bottom-0 lg:left-56">
      <div className="mx-auto w-full max-w-3xl px-4 lg:max-w-[96rem]">
        <div className="flex flex-wrap items-center gap-2 py-2">
          <span className="text-sm font-semibold text-[--color-text]">
            Compare <span className="tabular-nums">{selected.length}</span> of {MAX_COMPARE}
          </span>

          <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {selected.map((f) => (
              <li key={`${f.kind}:${f.ccn}`}>
                <button
                  onClick={() => onRemove(f)}
                  aria-label={`Remove ${titleCaseName(f.name)} from comparison`}
                  className="inline-flex min-h-[1.75rem] max-w-[14rem] items-center gap-1 rounded-[--radius-pill] border border-[--color-border-strong] px-2.5 py-1 text-xs text-[--color-text]"
                >
                  <span className="truncate">{titleCaseName(f.name)}</span>
                  <span aria-hidden="true" className="text-[--color-text-muted]">✕</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              disabled={selected.length < 2}
              title={selected.length < 2 ? 'Select at least two facilities to compare' : undefined}
              className="min-h-[2.25rem] rounded-[--radius-md] bg-[--color-brand] px-3 py-1.5 text-sm font-medium text-[--color-brand-contrast] disabled:opacity-50"
            >
              {open ? 'Hide comparison' : selected.length < 2 ? 'Add one more' : 'Compare'}
            </button>
            <button
              onClick={onClear}
              className="min-h-[2.25rem] px-2 text-sm font-medium text-[--color-text-secondary] underline-offset-2 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        {open && selected.length >= 2 && (
          <div className="max-h-[60vh] overflow-y-auto border-t border-[--color-border] py-3">
            <CompareTable entries={entries} />
          </div>
        )}
      </div>
    </div>
  )
}
