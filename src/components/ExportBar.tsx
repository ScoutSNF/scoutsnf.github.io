import { useState } from 'react'
import type { FacilityWithDistance, FacilityRecord } from '../types/facility'
import { rowsToCsv, downloadCsv, copyTableToClipboard, type CsvRow } from '../lib/exportCsv'
import { getBedsDisplay, getOccupancyDisplay } from '../lib/facilityDisplay'

const HEADERS = ['Name', 'Type', 'City', 'State', 'Distance (mi)', 'Beds', 'Occupancy', 'Rating', 'CCN']

function toRows(items: FacilityWithDistance<FacilityRecord>[]): CsvRow[] {
  return items.map(({ facility, distanceMiles }) => ({
    Name: facility.name,
    Type: facility.kind === 'snf' ? 'SNF' : facility.hospitalType,
    City: facility.city,
    State: facility.state,
    'Distance (mi)': distanceMiles.toFixed(1),
    Beds: getBedsDisplay(facility),
    Occupancy: getOccupancyDisplay(facility).text,
    Rating: facility.overallRating ?? '',
    CCN: facility.ccn
  }))
}

export function ExportBar({ items, anchorName }: { items: FacilityWithDistance<FacilityRecord>[]; anchorName: string }) {
  const [copied, setCopied] = useState(false)

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
        onClick={() => downloadCsv(`${anchorName.replace(/[^a-z0-9]+/gi, '-')}-scoutsnf.csv`, rowsToCsv(HEADERS, toRows(items)))}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Download CSV
      </button>
    </div>
  )
}
