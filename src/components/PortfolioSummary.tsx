import type { PortfolioSummaryData, PortfolioSummaryRow, MetricCell, SummaryMetricKey } from '../lib/portfolioSummary'
import { SUMMARY_METRICS, describeComparisonSet, formatMetric } from '../lib/portfolioSummary'

/**
 * Portfolio summary.
 *
 * Only the gap is coloured, never the value: a 2-star home is not red, a 2-star home in a 4-star
 * market is. Grey covers both "within the neutral band" and "no comparison available", because
 * neither is a finding.
 */

const DELTA_CLASS: Record<MetricCell['direction'], string> = {
  better: 'text-[--color-positive]',
  worse: 'text-[--color-negative]',
  same: 'text-[--color-text-muted]'
}

function Delta({ cell, metricKey, basis }: { cell: MetricCell; metricKey: SummaryMetricKey; basis: PortfolioSummaryRow['basis'] }) {
  if (cell.median == null) {
    return <span className="block text-[11px] leading-tight text-[--color-text-muted]">—</span>
  }
  const sign = cell.deltaPct == null ? '' : cell.deltaPct > 0 ? '+' : ''
  const gap = cell.deltaPct == null ? '' : ` (${sign}${Math.round(cell.deltaPct)}%)`
  return (
    <span className={`block text-[11px] leading-tight ${DELTA_CLASS[cell.direction]}`}>
      {basis === 'county' ? 'county ' : ''}
      {formatMetric(cell.median, metricKey)}
      {gap}
    </span>
  )
}

export function PortfolioSummary({ data }: { data: PortfolioSummaryData }) {
  if (data.rows.length === 0) return null

  return (
    // min-w-0 and max-w-full matter: as a flex item this section would otherwise be sized by the
    // table's min-content width, which is what let the whole page scroll sideways on a phone.
    <section className="min-w-0 max-w-full rounded-[--radius-lg] border border-[--color-border] bg-[--color-surface]">
      <div className="border-b border-[--color-border] px-3 py-2.5">
        <h2 className="text-sm font-semibold text-[--color-text]">Portfolio summary</h2>
        {data.headline && <p className="mt-1 text-sm text-[--color-text-secondary]">{data.headline}</p>}
      </div>

      {/* The scroll lives on this box, not the page: min-w-0 lets it actually shrink inside a flex
          column, without which the table would push the whole page sideways on a phone. */}
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[--color-border]">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-[11rem] bg-[--color-surface] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[--color-text-secondary]"
              >
                Home
              </th>
              {SUMMARY_METRICS.map((m) => (
                <th
                  key={m.key}
                  scope="col"
                  className="whitespace-nowrap px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-[--color-text-secondary]"
                >
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.ccn} className="border-b border-[--color-border] last:border-0">
                {/* Sticky so the name stays put while the metrics scroll under it. The right border
                    stands in for a shadow, which would be clipped by overflow-x. */}
                <th
                  scope="row"
                  className="sticky left-0 z-10 min-w-[11rem] border-r border-[--color-border] bg-[--color-surface] px-3 py-2 text-left font-medium"
                >
                  <span className="block text-[--color-text]">{row.name}</span>
                  <span className="block text-[11px] font-normal leading-tight text-[--color-text-muted]">
                    {row.city}, {row.state} · {describeComparisonSet(row)}
                  </span>
                </th>
                {SUMMARY_METRICS.map((m) => (
                  <td key={m.key} className="px-3 py-2 text-right align-top">
                    <span className="block tabular-nums text-[--color-text]">
                      {formatMetric(row.metrics[m.key].value, m.key)}
                    </span>
                    <Delta cell={row.metrics[m.key]} metricKey={m.key} basis={row.basis} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
