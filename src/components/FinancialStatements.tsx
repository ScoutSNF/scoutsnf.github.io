import type { FacilityYearRecord } from '../types/costReport'

function money(n: number | null): string {
  if (n == null) return '—'
  const abs = Math.abs(n).toLocaleString('en-US')
  return n < 0 ? `-$${abs}` : `$${abs}`
}

function count(n: number | null): string {
  return n == null ? '—' : n.toLocaleString('en-US')
}

function pct(n: number | null): string {
  return n == null ? '' : ` (${n}%)`
}

interface Row {
  label: string
  values: (number | null)[]
  /** Subtotal/total rows render with a top rule, mirroring the filed worksheet. */
  subtotal?: boolean
  /** Deduction lines are displayed with a leading minus, as on the filed form. */
  negate?: boolean
  indent?: boolean
}

function StatementTable({
  title,
  worksheet,
  years,
  rows,
  note
}: {
  title: string
  worksheet: string
  years: string[]
  rows: Row[]
  note?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</h3>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">{worksheet}</span>
      </div>
      {/* Two year columns fit phone widths; overflow-x-auto is the safety net, never the plan. */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="py-1 pr-2 text-left font-medium"></th>
              {years.map((y) => (
                <th key={y} className="py-1 pl-2 font-medium tabular-nums">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className={`${row.subtotal ? 'border-t border-slate-300 font-semibold dark:border-slate-600' : ''} ${
                  row.values.every((v) => v == null) ? 'hidden' : ''
                }`}
              >
                <td className={`py-1 pr-2 text-left text-slate-600 dark:text-slate-300 ${row.indent ? 'pl-3' : ''}`}>{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className="py-1 pl-2 tabular-nums text-slate-800 dark:text-slate-100">
                    {row.negate && v != null ? money(-v) : money(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note && <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-400">{note}</p>}
    </div>
  )
}

/**
 * The filed statements behind the trend charts: income statement (Worksheet G-3), balance sheet
 * (Worksheet G) and utilization (Worksheet S-3) for the two most recent fiscal years on file.
 * Every figure is the filed worksheet line -- nothing is estimated. Years are labelled by the
 * fiscal year they begin in ("FY 2024" = the report beginning in 2024).
 */
export function FinancialStatements({ records }: { records: FacilityYearRecord[] }) {
  if (records.length === 0) return null
  // Most recent two years with any financial content, oldest on the right -- matching how the
  // statements read on the filed form (current year first).
  const shown = records.slice(-2).reverse()
  const years = shown.map((r) => `FY ${r.fyBeginDate.slice(0, 4)}`)

  const expenseLabels = [...new Set(shown.flatMap((r) => r.otherExpensesLabels ?? []))]

  const incomeRows: Row[] = [
    { label: 'Total patient revenues', values: shown.map((r) => r.totalPatientRevenue) },
    { label: 'Less: contractual allowances & discounts', values: shown.map((r) => r.contractualAllowances), negate: true },
    { label: 'Net patient revenues', values: shown.map((r) => r.netPatientRevenue), subtotal: true },
    { label: 'Less: total operating expenses', values: shown.map((r) => r.totalOperatingExpenses), negate: true },
    { label: 'Net income from service to patients', values: shown.map((r) => r.netIncomeFromService), subtotal: true },
    { label: 'Other income', values: shown.map((r) => r.otherIncome) },
    { label: 'Total income', values: shown.map((r) => r.totalIncome), subtotal: true },
    // The itemized other-expenses lines carry the filer's own labels; shown as one deduction line.
    {
      label:
        expenseLabels.length === 1
          ? `Other expenses: ${expenseLabels[0].toLowerCase()}`
          : 'Other expenses',
      values: shown.map((r) => r.otherExpenses),
      negate: true
    },
    { label: 'Net income (loss) for the period', values: shown.map((r) => r.netIncome), subtotal: true }
  ]

  const balanceRows: Row[] = [
    { label: 'Cash', values: shown.map((r) => r.cash) },
    { label: 'Accounts receivable', values: shown.map((r) => r.accountsReceivable) },
    { label: 'Total current assets', values: shown.map((r) => r.totalCurrentAssets), subtotal: true },
    { label: 'Total assets', values: shown.map((r) => r.totalAssets), subtotal: true },
    { label: 'Accounts payable', values: shown.map((r) => r.accountsPayable) },
    { label: 'Total current liabilities', values: shown.map((r) => r.totalCurrentLiabilities), subtotal: true },
    { label: 'Total long-term liabilities', values: shown.map((r) => r.totalLongTermLiabilities) },
    { label: 'Total liabilities', values: shown.map((r) => r.totalLiabilities), subtotal: true },
    { label: 'Fund balance (equity)', values: shown.map((r) => r.fundBalance), subtotal: true }
  ]

  const utilizationRows: Row[] = [
    { label: 'Total patient days', values: shown.map((r) => r.totalPatientDays) },
    {
      label: 'Medicare days',
      values: shown.map((r) => r.medicarePatientDays)
    },
    { label: 'Medicaid days', values: shown.map((r) => r.medicaidPatientDays) },
    { label: 'Other payer days', values: shown.map((r) => r.otherPatientDays) },
    { label: 'Bed days available', values: shown.map((r) => r.bedDaysAvailable) }
  ]

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      <StatementTable
        title="Income statement"
        worksheet="Worksheet G-3"
        years={years}
        rows={incomeRows}
        note="As filed. Every subtotal above equals the filed worksheet line; a named other-expenses line is the facility's own entry."
      />
      <StatementTable
        title="Balance sheet"
        worksheet="Worksheet G"
        years={years}
        rows={balanceRows}
        note="As filed. Total assets equal total liabilities plus fund balance on the filed form."
      />
      <div className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300">Utilization</h3>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">Worksheet S-3</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-1 pr-2 text-left font-medium"></th>
                {years.map((y) => (
                  <th key={y} className="py-1 pl-2 font-medium tabular-nums">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {utilizationRows.map((row) => (
                <tr key={row.label} className={row.values.every((v) => v == null) ? 'hidden' : ''}>
                  <td className="py-1 pr-2 text-left text-slate-600 dark:text-slate-300">{row.label}</td>
                  {shown.map((r, i) => (
                    <td key={i} className="py-1 pl-2 tabular-nums text-slate-800 dark:text-slate-100">
                      {row.label === 'Medicare days'
                        ? `${count(r.medicarePatientDays)}${pct(r.medicarePct)}`
                        : row.label === 'Medicaid days'
                          ? `${count(r.medicaidPatientDays)}${pct(r.medicaidPct)}`
                          : row.label === 'Other payer days'
                            ? `${count(r.otherPatientDays)}${pct(r.otherPct)}`
                            : count(row.values[i])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-slate-300 font-semibold dark:border-slate-600">
                <td className="py-1 pr-2 text-left text-slate-600 dark:text-slate-300">Occupancy</td>
                {shown.map((r, i) => (
                  <td key={i} className="py-1 pl-2 tabular-nums text-slate-800 dark:text-slate-100">
                    {r.occupancyPct != null ? `${r.occupancyPct}%` : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">
        Source: CMS Medicare cost reports (HCRIS), fiscal years as filed. Figures are the facility's own filed amounts, not audited
        restatements.
      </p>
    </div>
  )
}
