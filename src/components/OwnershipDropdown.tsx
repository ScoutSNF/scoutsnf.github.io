import type { OwnershipRecord } from '../data/ownership'

// CMS returns roles as a fixed, shouting-caps vocabulary ("5% OR GREATER DIRECT OWNERSHIP
// INTEREST", "W-2 MANAGING EMPLOYEE") -- sentence-case it for a label that's now primary UI
// content, not just a backing field. Names are deliberately left raw elsewhere in the app since
// they're free-form proper nouns, not a small controlled vocabulary like this is.
function formatRole(role: string): string {
  if (!role) return role
  return role.charAt(0) + role.slice(1).toLowerCase()
}

/** Native <details> disclosure listing an SNF's owners, sorted by ownership % descending. */
export function OwnershipDropdown({
  records,
  loading,
  error
}: {
  records: OwnershipRecord[] | null
  loading: boolean
  error: boolean
}) {
  return (
    <details className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
      <summary className="cursor-pointer select-none font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
        Owners{records && records.length > 0 ? ` (${records.length})` : ''}
      </summary>
      <div className="mt-1.5 flex flex-col gap-1 pl-1">
        {loading && <span>Loading…</span>}
        {error && <span>Ownership data unavailable</span>}
        {records && records.length === 0 && <span>No ownership disclosure on file</span>}
        {records &&
          [...records]
            .sort((a, b) => {
              const pa = parseFloat(a.percentage)
              const pb = parseFloat(b.percentage)
              if (Number.isNaN(pa) && Number.isNaN(pb)) return 0
              if (Number.isNaN(pa)) return 1
              if (Number.isNaN(pb)) return -1
              return pb - pa
            })
            .map((o, i) => {
              const pct = /^\d/.test(o.percentage) ? o.percentage : 'N/A'
              return (
                <div key={i} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-slate-700 dark:text-slate-200">{o.ownerName}</span>
                    {o.role && <span className="block text-[10px] text-slate-400 dark:text-slate-500">{formatRole(o.role)}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{pct}</span>
                </div>
              )
            })}
      </div>
    </details>
  )
}
