import type { FacilityRecord } from '../types/facility'
import type { MarketMedians, MedianStat, Standout } from '../lib/marketMedians'
import { MIN_SAMPLE } from '../lib/marketMedians'
import { InfoPopover } from './InfoPopover'
import type { LegendKey } from '../lib/legend'

function Row({
  label,
  legendKey,
  stat,
  format,
  /** Which direction is favourable for the anchor, used only for colour. */
  goodDirection
}: {
  label: string
  legendKey: LegendKey
  stat: MedianStat
  format: (n: number) => string
  goodDirection: 'up' | 'down'
}) {
  if (stat.median == null) return null

  const delta = stat.delta
  const isGood = delta != null && delta !== 0 && (goodDirection === 'up' ? delta > 0 : delta < 0)
  const isBad = delta != null && delta !== 0 && !isGood

  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
        {label}
        <InfoPopover legendKey={legendKey} />
      </span>
      <span className="flex items-baseline gap-2 tabular-nums">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          median {format(stat.median)}
        </span>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {stat.anchor != null ? format(stat.anchor) : '—'}
        </span>
        {delta != null && delta !== 0 && (
          <span
            className={`text-xs font-semibold ${
              isGood ? 'text-emerald-700 dark:text-emerald-400' : isBad ? 'text-red-700 dark:text-red-400' : 'text-slate-500'
            }`}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </span>
        )}
      </span>
    </div>
  )
}

/**
 * How the anchor compares with the SNFs around it.
 *
 * Shows nothing at all when the radius holds too few reporting facilities to support a median --
 * a median of two is noise, and presenting it would be worse than presenting nothing.
 */
export function MarketMediansCard({
  medians,
  standouts,
  anchor,
  radiusMiles
}: {
  medians: MarketMedians
  standouts: Standout[]
  anchor: FacilityRecord
  radiusMiles: number
}) {
  const hasAny =
    medians.occupancy.median != null || medians.rating.median != null || medians.medicaidMix.median != null
  const sample = Math.max(medians.occupancy.n, medians.rating.n, medians.medicaidMix.n)

  // Returning null outright when no median clears the sample floor would make the explanation
  // below unreachable -- a sparse market would show nothing at all, which reads as a broken card
  // rather than an honest "not enough neighbours to compare against". Only a market with no
  // competitors whatsoever is silent.
  if (!hasAny && medians.competitorCount === 0) return null

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-sm font-semibold">
          {anchor.kind === 'snf' ? 'This facility vs. its local market' : 'Local SNF market'}
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {sample} of {medians.competitorCount} SNFs within {radiusMiles} mi
        </span>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        <Row
          label="Occupancy"
          legendKey="snf-occupancy"
          stat={medians.occupancy}
          format={(n) => `${n}%`}
          goodDirection="up"
        />
        <Row
          label="Overall rating"
          legendKey="snf-overall-rating"
          stat={medians.rating}
          format={(n) => `${n}★`}
          goodDirection="up"
        />
        <Row
          label="Medicaid mix"
          legendKey="cost-report-payer-mix"
          stat={medians.medicaidMix}
          format={(n) => `${n}%`}
          goodDirection="down"
        />
      </div>

      {standouts.length > 0 && anchor.kind === 'snf' && (
        <div className="mt-2.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            What stands out
          </h3>
          <ul className="flex flex-col gap-1">
            {standouts.map((s) => (
              <li key={s.text} className="flex items-start gap-1.5 text-xs leading-snug">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    s.tone === 'good' ? 'bg-emerald-500' : s.tone === 'bad' ? 'bg-red-500' : 'bg-slate-400'
                  }`}
                />
                <span className="text-slate-700 dark:text-slate-200">{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sample < MIN_SAMPLE && (
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          Too few reporting facilities nearby for a reliable median — widen the radius.
        </p>
      )}
    </section>
  )
}
