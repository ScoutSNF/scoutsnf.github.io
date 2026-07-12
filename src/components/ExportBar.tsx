import { useState } from 'react'
import type { FacilityWithDistance, FacilityRecord } from '../types/facility'
import { getBedsDisplay, getOccupancyDisplay } from '../lib/facilityDisplay'

const HEADERS = ['Name', 'Type', 'City', 'State', 'Distance (mi)', 'Beds', 'Occupancy', 'Rating', 'CCN']
const COLUMN_WIDTHS = [34, 12, 16, 7, 12, 8, 12, 8, 10]

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
    <button
      onClick={exportWorkbook}
      disabled={exporting}
      title="Download report (Excel)"
      className="shrink-0 text-xl text-slate-300 hover:text-brand disabled:opacity-40 dark:text-slate-600 dark:hover:text-slate-300"
    >
      <DownloadIcon />
    </button>
  )
}
