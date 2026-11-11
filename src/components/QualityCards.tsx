import type { SnfRecord } from '../types/facility'
import { formatDate } from '../lib/facilityDisplay'

function fmt(n: number | null | undefined, digits = 2): string {
  return n == null ? 'N/A' : n.toFixed(digits)
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-0.5">
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {label}
        {sub && <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">{sub}</span>}
      </span>
      <span className="text-sm font-medium tabular-nums text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  )
}

/**
 * The staffing figures behind the Staffing star rating, all from CMS Provider Information.
 * Nurse-staffing hours are CMS's case-mix **adjusted** figures (the only ones comparable between
 * facilities); PT is reported, not adjusted, and says so. Collapsed by default so the Overview
 * stays lean on a phone -- the detail is one tap away.
 */
export function StaffingDetailCard({ facility }: { facility: SnfRecord }) {
  const hasAny =
    facility.rnStaffingHprd != null ||
    facility.totalNurseStaffingHprd != null ||
    facility.nursingTurnoverPct != null ||
    facility.caseMixIndex != null
  if (!hasAny) return null

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <summary className="cursor-pointer select-none text-sm font-semibold">Staffing detail</summary>
      <div className="mt-2 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
        <Row label="Total nurse hrs/res/day" sub="adjusted" value={fmt(facility.totalNurseStaffingHprd)} />
        <Row label="RN hrs" value={fmt(facility.rnStaffingHprd)} />
        <Row label="LPN hrs" value={fmt(facility.lpnStaffingHprd)} />
        <Row label="Aide hrs" value={fmt(facility.aideStaffingHprd)} />
        <Row label="Weekend total" sub="adjusted" value={fmt(facility.weekendNurseStaffingHprd)} />
        <Row label="PT hrs" sub="reported" value={fmt(facility.ptStaffingHprd)} />
        <Row label="Nursing turnover" value={facility.nursingTurnoverPct != null ? `${facility.nursingTurnoverPct}%` : 'N/A'} />
        <Row label="RN turnover" value={facility.rnTurnoverPct != null ? `${facility.rnTurnoverPct}%` : 'N/A'} />
        <Row label="Case-mix index" value={fmt(facility.caseMixIndex, 3)} />
        <Row label="Case-mix ratio" value={fmt(facility.caseMixRatio, 3)} />
      </div>
    </details>
  )
}

/**
 * Survey history and penalties from CMS Provider Information: the two most recent standard
 * survey cycles, the weighted health survey score (lower is better), and fines on record.
 */
export function SurveysCard({ facility }: { facility: SnfRecord }) {
  const hasAny =
    facility.latestSurveyDate != null || facility.weightedSurveyScore != null || facility.totalFinesAmount != null
  if (!hasAny) return null

  const surveyLine = (date: string | null | undefined, defs: number | null | undefined) => {
    if (!date) return null
    return `${formatDate(date)}${defs != null ? ` · ${defs} ${defs === 1 ? 'deficiency' : 'deficiencies'}` : ''}`
  }
  const latest = surveyLine(facility.latestSurveyDate, facility.latestSurveyDeficiencies)
  const prior = surveyLine(facility.priorSurveyDate, facility.priorSurveyDeficiencies)

  return (
    <details className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <summary className="cursor-pointer select-none text-sm font-semibold">Surveys &amp; penalties</summary>
      <div className="mt-2 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
        {latest && <Row label="Latest standard survey" value={latest} />}
        {prior && <Row label="Prior cycle" value={prior} />}
        <Row label="Weighted health survey score" sub="lower is better" value={facility.weightedSurveyScore != null ? String(facility.weightedSurveyScore) : 'N/A'} />
        <Row
          label="Fines"
          value={facility.totalFinesAmount != null ? `$${facility.totalFinesAmount.toLocaleString('en-US')} on record` : 'N/A'}
        />
      </div>
    </details>
  )
                     }
