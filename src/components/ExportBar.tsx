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
    <div className="flex gap-2">
      <button
        onClick={async () => {
          await copyTableToClipboard(HEADERS, toRows(items))
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {copied ? 'Copied!' : 'Copy as table'}
      </button>
      <button
        onClick={exportWorkbook}
        disabled={exporting}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        {exporting ? 'Building…' : 'Download report (Excel)'}
      </button>
    </div>
  )
}
