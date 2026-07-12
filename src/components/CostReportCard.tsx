import { useState } from 'react'
import { InfoPopover } from './InfoPopover'
import type { LegendKey } from '../lib/legend'
import type { FacilityYearRecord } from '../types/costReport'

function formatFyLabel(fyEndDate: string): string {
  const d = new Date(fyEndDate)
  if (Number.isNaN(d.getTime())) return fyEndDate
  return `FYE ${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

function fyShort(fyBeginDate: string): string {
  const year = fyBeginDate.slice(0, 4)
  return `FY${year.slice(2)}`
}

function isSettled(status: number): boolean {
  return status !== 1
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function StatTile({
  label,
  legendKey,
  value,
  delta,
  deltaGoodDirection,
  valueClassName
}: {
  label: string
  legendKey: LegendKey
  value: string
  delta: number | null
  deltaGoodDirection: 'up' | 'down'
  valueClassName?: string
}) {
  const deltaUp = delta != null && delta > 0
  const deltaDown = delta != null && delta < 0
  const isGood = delta != null && ((deltaGoodDirection === 'up' && deltaUp) || (deltaGoodDirection === 'down' && deltaDown))
  const isBad = delta != null && delta !== 0 && !isGood

  return (
    <div>
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
        <InfoPopover legendKey={legendKey} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-lg font-bold ${valueClassName ?? ''}`}>{value}</span>
        {delta != null && delta !== 0 && (
          <span
            className={`text-xs font-semibold ${isGood ? 'text-emerald-600 dark:text-emerald-400' : isBad ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}
          >
            {deltaUp ? '↑' : '↓'}
            {Math.abs(delta)}
          </span>
        )}
      </div>
    </div>
  )
}

function TrendLine({ points, color }: { points: { label: string; value: number }[]; color: string }) {
  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const padTop = 10
  const padBottom = 54
  const w = 220
  const xFor = (i: number) => (points.length === 1 ? w / 2 : (i / (points.length - 1)) * (w - 20) + 10)
  const yFor = (v: number) => padTop + (1 - (v - min) / span) * (padBottom - padTop)

  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.value) }))
  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
  const fillD = `${pathD} L ${coords[coords.length - 1].x.toFixed(1)} 64 L ${coords[0].x.toFixed(1)} 64 Z`

  return (
    <svg viewBox="0 0 220 64" width="100%" height="64" className="overflow-visible">
      <line x1="0" y1={padBottom} x2={w} y2={padBottom} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" strokeDasharray="2,3" />
      <path d={fillD} fill={color} opacity="0.08" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4 : 2.5} fill={color} />
      ))}
    </svg>
  )
}

const MIX_COLORS = {
  medicare: '#0d8fae',
  medicaid: '#ad7c1f',
  other: '#7256b0'
}

function PayerSegment({
  widthPct,
  color,
  label,
  pct,
  roundedClass
}: {
  widthPct: number
  color: string
  label: string
  pct: number
  roundedClass: string
}) {
  const [pinned, setPinned] = useState(false)

  return (
    <div
      className={`group relative h-full cursor-pointer ${roundedClass}`}
      style={{ width: `${widthPct}%`, background: color }}
      onClick={() => setPinned((p) => !p)}
      aria-label={`${label} ${pct}%`}
    >
      <div
        className={`pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-lg transition-opacity dark:bg-slate-700 ${
          pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {label} {pct}%
      </div>
    </div>
  )
}

function PayerMixTrend({ records }: { records: FacilityYearRecord[] }) {
  const usable = records.filter((r) => r.medicarePct != null && r.medicaidPct != null && r.otherPct != null)
  if (usable.length === 0) return null

  return (
    <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
      <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Payer mix
        <InfoPopover legendKey="cost-report-payer-mix" />
      </div>
      <div className="flex gap-2.5">
        {usable.map((r) => {
          const segments = [
            { label: 'Medicare', pct: r.medicarePct!, color: MIX_COLORS.medicare },
            { label: 'Medicaid', pct: r.medicaidPct!, color: MIX_COLORS.medicaid },
            { label: 'Other', pct: r.otherPct!, color: MIX_COLORS.other }
          ].filter((s) => s.pct > 0)

          return (
            <div key={r.fyBeginDate} className="flex flex-1 flex-col gap-1">
              <div className="flex h-4">
                {segments.map((s, i) => (
                  <PayerSegment
                    key={s.label}
                    widthPct={s.pct}
                    color={s.color}
                    label={s.label}
                    pct={s.pct}
                    roundedClass={`${i === 0 ? 'rounded-l' : ''} ${i === segments.length - 1 ? 'rounded-r' : ''}`}
                  />
                ))}
              </div>
              <span className="text-center text-[9px] tabular-nums text-slate-400">{fyShort(r.fyBeginDate)}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS.medicare }} /> Medicare
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS.medicaid }} /> Medicaid
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: MIX_COLORS.other }} /> Other
        </span>
      </div>
    </div>
  )
}

export function CostReportCard({ records, kind }: { records: FacilityYearRecord[]; kind: 'snf' | 'hospital' }) {
  if (records.length === 0) return null

  const latest = records[records.length - 1]
  const prior = records.length >= 2 ? records[records.length - 2] : null
  const trendRecords = records.filter((r) => r.occupancyPct != null)

  const occupancyDelta = prior?.occupancyPct != null && latest.occupancyPct != null ? round1(latest.occupancyPct - prior.occupancyPct) : null
  const marginDelta =
    prior?.operatingMarginPct != null && latest.operatingMarginPct != null ? round1(latest.operatingMarginPct - prior.operatingMarginPct) : null
  const medicaidDelta = prior?.medicaidPct != null && latest.medicaidPct != null ? round1(latest.medicaidPct - prior.medicaidPct) : null

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Cost Report</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isSettled(latest.reportStatus)
              ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              : 'bg-gold/15 text-brand dark:text-gold'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isSettled(latest.reportStatus) ? 'bg-emerald-500' : 'bg-gold'}`} />
          {formatFyLabel(latest.fyEndDate)} · {latest.reportStatusLabel}
          <InfoPopover legendKey="cost-report-status" />
        </span>
      </div>

      <div className={`grid gap-3 ${kind === 'snf' ? 'grid-cols-3' : 'grid-cols-1'}`}>
        <StatTile
          label="Occupancy"
          legendKey="cost-report-occupancy"
          value={latest.occupancyPct != null ? `${latest.occupancyPct}%` : 'N/A'}
          delta={occupancyDelta}
          deltaGoodDirection="up"
        />
        {kind === 'snf' && (
          <>
            <StatTile
              label="Operating margin"
              legendKey="cost-report-margin"
              value={latest.operatingMarginPct != null ? `${latest.operatingMarginPct}%` : 'N/A'}
              delta={marginDelta}
              deltaGoodDirection="up"
              valueClassName={latest.operatingMarginPct != null && latest.operatingMarginPct < 0 ? 'text-red-600 dark:text-red-400' : ''}
            />
            <StatTile
              label="Medicaid mix"
              legendKey="cost-report-payer-mix"
              value={latest.medicaidPct != null ? `${latest.medicaidPct}%` : 'N/A'}
              delta={medicaidDelta}
              deltaGoodDirection="down"
            />
          </>
        )}
      </div>

      {trendRecords.length >= 2 && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            3-year trend
            <InfoPopover legendKey="cost-report-trend" />
          </div>
          <div className={`grid gap-2.5 ${kind === 'snf' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
              <div className="mb-0.5 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Occupancy</span>
                <span className="text-xs font-bold">{latest.occupancyPct}%</span>
              </div>
              <TrendLine points={trendRecords.map((r) => ({ label: fyShort(r.fyBeginDate), value: r.occupancyPct! }))} color="#0d8fae" />
              <div className="flex justify-between text-[9px] tabular-nums text-slate-400">
                {trendRecords.map((r) => (
                  <span key={r.fyBeginDate}>{fyShort(r.fyBeginDate)}</span>
                ))}
              </div>
            </div>

            {kind === 'snf' && trendRecords.filter((r) => r.operatingMarginPct != null).length >= 2 && (
              <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
                <div className="mb-0.5 flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Operating margin</span>
                  <span className={`text-xs font-bold ${latest.operatingMarginPct != null && latest.operatingMarginPct < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {latest.operatingMarginPct}%
                  </span>
                </div>
                <TrendLine
                  points={trendRecords.filter((r) => r.operatingMarginPct != null).map((r) => ({ label: fyShort(r.fyBeginDate), value: r.operatingMarginPct! }))}
                  color="#0f4c5c"
                />
                <div className="flex justify-between text-[9px] tabular-nums text-slate-400">
                  {trendRecords
                    .filter((r) => r.operatingMarginPct != null)
                    .map((r) => (
                      <span key={r.fyBeginDate}>{fyShort(r.fyBeginDate)}</span>
                    ))}
                </div>
              </div>
            )}
          </div>

          {kind === 'snf' && <div className="mt-2.5">
            <PayerMixTrend records={records} />
          </div>}
        </div>
      )}
    </div>
  )
}
