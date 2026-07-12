import { useState } from 'react'
import type { FacilityWithDistance, FacilityRecord } from '../types/facility'
import { copyTableToClipboard, type CsvRow } from '../lib/exportCsv'
import { getBedsDisplay, getOccupancyDisplay } from '../lib/facilityDisplay'

const HEADERS = ['Name', 'Type', 'City', 'State', 'Distance (mi)', 'Beds', 'Occupancy', 'Rating', 'CCN']
const COLUMN_WIDTHS = [34, 12, 16, 7, 12, 8, 12, 8, 10]

function toRows(items: FacilityWithDistance<FacilityRecord>[]): CsvRow[] {
  return items.map(({ facility, distanceMiles }) => ({
    Name: facility.name,
    Type: facility.kind === 'snf' ? 'SNF' : facility.hospitalType,
    City: facility.city,
    State: facility.state,
    'Distance (mi)': distanceMiles.toFixed(2),
    Beds: getBedsDisplay(facility),
    Occupancy: getOccupancyDisplay(facility).text,
    Rating: facility.overallRating ?? '',
    CCN: facility.ccn
  }))
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  )
}

export function ExportBar({ items, anchorName }: { items: FacilityWithDistance<FacilityRecord>[]; anchorName: string }) {
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function exportWorkbook() {
    setExporting(true)
    try {
      const { buildSimpleWorkbook, downloadBlob } = await import('../lib/simpleWorkbook')
      const rows = items.map(({ facility, distanceMiles }) => [
        facility.name,
        facility.kind === 'snf' ? 'SNF' : facility.hospitalType,
        facility.city,
        facility.state,
        distanceMiles.toFixed(2),
        getBedsDisplay(facility),
        getOccupancyDisplay(facility).text,
        facility.overallRating != null ? facility.overallRating.toFixed(1) : '—',
        facility.ccn
      ])
      const blob = await buildSimpleWorkbook({
        title: `Nearby facilities — ${anchorName}`,
        subtitle: `Generated ${new Date().toLocaleString()} · ${items.length} facilit${items.length === 1 ? 'y' : 'ies'}`,
        sheetName: 'Results',
        headers: HEADERS,
        columnWidths: COLUMN_WIDTHS,
        rows
      })
      downloadBlob(`${anchorName.replace(/[^a-z0-9]+/gi, '-')}-scoutsnf.xlsx`, blob)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        onClick={async () => {
          await copyTableToClipboard(HEADERS, toRows(items))
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        title="Copy as table"
        className="text-xl text-slate-300 hover:text-brand dark:text-slate-600 dark:hover:text-slate-300"
      >
        {copied ? <CheckIcon className="text-emerald-500" /> : <CopyIcon />}
      </button>
      <button
        onClick={exportWorkbook}
        disabled={exporting}
        title="Download report (Excel)"
        className="text-xl text-slate-300 hover:text-brand disabled:opacity-40 dark:text-slate-600 dark:hover:text-slate-300"
      >
        <DownloadIcon />
      </button>
    </div>
  )
}
