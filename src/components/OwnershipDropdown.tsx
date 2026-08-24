import type { OwnershipRecord } from '../data/ownership'
import { formatRole } from '../lib/ownershipDisplay'

type Tier = 'direct' | 'indirect' | 'other'

// CMS discloses ownership as a flat list that mixes multiple layers of a facility's corporate
// structure: the operating entity's own owners ("direct"), plus owners of *those* owners
// ("indirect" -- e.g. a person who owns a stake in an LLC that owns the facility, not the
// facility itself), plus non-ownership roles (officers, managers). Percentages only sum to ~100%
// within the same tier -- grouping keeps that readable instead of implying one flat 100% pool.
function tierOf(role: string): Tier {
  const r = role.toUpperCase()
  if (r.includes('INDIRECT')) return 'indirect'
  if (r.includes('DIRECT')) return 'direct'
  return 'other'
}

const TIER_LABEL: Record<Tier, string> = {
  direct: 'Direct ownership',
  indirect: 'Indirect ownership (of the entities above)',
  other: 'Other roles'
}

function sortByPct(records: OwnershipRecord[]): OwnershipRecord[] {
  return [...records].sort((a, b) => {
    const pa = parseFloat(a.percentage)
    const pb = parseFloat(b.percentage)
    if (Number.isNaN(pa) && Number.isNaN(pb)) return 0
    if (Number.isNaN(pa)) return 1
    if (Number.isNaN(pb)) return -1
    return pb - pa
  })
}

function OwnerRow({ record }: { record: OwnershipRecord }) {
  const pct = /^\d/.test(record.percentage) ? record.percentage : 'N/A'
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="min-w-0">
        <span className="block text-slate-700 dark:text-slate-200">{record.ownerName}</span>
        {record.role && <span className="block text-[10px] text-slate-400 dark:text-slate-500">{formatRole(record.role)}</span>}
      </span>
      <span className="shrink-0 tabular-nums">{pct}</span>
    </div>
  )
}

/** Native <details> disclosure listing an SNF's owners, grouped by ownership tier and sorted by % within each. */
export function OwnershipDropdown({
  records,
  loading,
  error
}: {
  records: OwnershipRecord[] | null
  loading: boolean
  error: boolean
}) {
  const tiers: [Tier, OwnershipRecord[]][] =
    records != null
      ? (['direct', 'indirect', 'other'] as const)
          .map((tier): [Tier, OwnershipRecord[]] => [tier, sortByPct(records.filter((r) => tierOf(r.role) === tier))])
          .filter(([, rows]) => rows.length > 0)
      : []
  const showTierLabels = tiers.length > 1

  return (
    <details className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
      <summary className="cursor-pointer select-none font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100">
        Owners{records && records.length > 0 ? ` (${records.length})` : ''}
      </summary>
      <div className="mt-1.5 flex flex-col gap-2.5 pl-1">
        {loading && <span>Loading…</span>}
        {error && <span>Ownership data unavailable</span>}
        {records && records.length === 0 && <span>No ownership disclosure on file</span>}
        {tiers.map(([tier, rows]) => (
          <div key={tier} className="flex flex-col gap-1">
            {showTierLabels && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {TIER_LABEL[tier]}
              </span>
            )}
            {rows.map((o, i) => (
              <OwnerRow key={i} record={o} />
            ))}
          </div>
        ))}
      </div>
    </details>
  )
}
