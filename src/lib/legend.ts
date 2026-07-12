export type LegendKey =
  | 'snf-beds'
  | 'snf-occupancy'
  | 'snf-overall-rating'
  | 'snf-sub-ratings'
  | 'snf-ownership'
  | 'snf-sff'
  | 'hospital-type'
  | 'hospital-overall-rating'
  | 'hospital-emergency'
  | 'hospital-beds'
  | 'cost-report-occupancy'
  | 'cost-report-margin'
  | 'cost-report-payer-mix'
  | 'cost-report-status'
  | 'cost-report-trend'
  | 'distance'
  | 'map-location'

export interface LegendEntry {
  key: LegendKey
  stat: string
  source: string
  refresh: string
  details: string | null
}

export interface LegendGroup {
  title: string
  keys: LegendKey[]
}

const ENTRIES: LegendEntry[] = [
  {
    key: 'snf-beds',
    stat: 'Certified beds',
    source: 'CMS Care Compare',
    refresh: '~monthly',
    details: null
  },
  {
    key: 'snf-occupancy',
    stat: 'Occupancy %',
    source: 'CMS Care Compare',
    refresh: '~monthly',
    details: 'Avg. daily census ÷ certified beds; shown with its own "as of" date'
  },
  {
    key: 'snf-overall-rating',
    stat: 'Overall star rating',
    source: 'CMS Care Compare',
    refresh: '~monthly',
    details: "CMS's 5-star composite"
  },
  {
    key: 'snf-sub-ratings',
    stat: 'Health inspection / staffing / quality measure ratings',
    source: 'CMS Care Compare',
    refresh: '~monthly',
    details: 'The three sub-scores that roll into the overall star rating'
  },
  {
    key: 'snf-ownership',
    stat: 'Ownership type',
    source: 'CMS Care Compare',
    refresh: '~monthly',
    details: null
  },
  {
    key: 'snf-sff',
    stat: 'Special Focus Facility status',
    source: 'CMS Care Compare',
    refresh: '~monthly',
    details: 'CMS flag for facilities under additional oversight'
  },
  {
    key: 'hospital-type',
    stat: 'Hospital type',
    source: 'CMS Hospital General Information',
    refresh: '~monthly',
    details: null
  },
  {
    key: 'hospital-overall-rating',
    stat: 'Overall star rating',
    source: 'CMS Hospital General Information',
    refresh: '~monthly',
    details: null
  },
  {
    key: 'hospital-emergency',
    stat: 'Emergency services (Y/N)',
    source: 'CMS Hospital General Information',
    refresh: '~monthly',
    details: null
  },
  {
    key: 'hospital-beds',
    stat: 'Certified beds (hospitals)',
    source: 'CMS Provider of Services file',
    refresh: 'Quarterly',
    details: null
  },
  {
    key: 'cost-report-occupancy',
    stat: 'Occupancy (cost-report basis)',
    source: 'CMS HCRIS cost reports',
    refresh: 'Quarterly (Jan/Apr/Jul/Oct)',
    details: 'Fiscal-year average, not a live snapshot'
  },
  {
    key: 'cost-report-margin',
    stat: 'Operating margin',
    source: 'CMS HCRIS cost reports',
    refresh: 'Quarterly',
    details: 'From Worksheet G/G-2/G-3'
  },
  {
    key: 'cost-report-payer-mix',
    stat: 'Payer mix (Medicare/Medicaid/other)',
    source: 'CMS HCRIS cost reports',
    refresh: 'Quarterly',
    details: 'Share of patient days, Worksheet S-3 Pt I'
  },
  {
    key: 'cost-report-status',
    stat: 'Report status badge',
    source: 'CMS HCRIS cost reports',
    refresh: 'Per report',
    details: 'As submitted = unaudited; settled/reopened/amended = finalized'
  },
  {
    key: 'cost-report-trend',
    stat: '3-year trend',
    source: 'Derived in-app',
    refresh: 'Derived',
    details: 'Built from the cost-report stats above once 2+ fiscal years are on file'
  },
  {
    key: 'distance',
    stat: 'Distance',
    source: 'Calculated in-app',
    refresh: 'Live',
    details: 'Straight-line, not drive time'
  },
  {
    key: 'map-location',
    stat: 'Facility map location',
    source: 'Census Geocoder (Nominatim fallback)',
    refresh: 'As needed',
    details: "A small number of facilities get corrected coordinates when CMS's own lat/lon collides with another facility's"
  }
]

const ENTRY_BY_KEY = new Map(ENTRIES.map((e) => [e.key, e]))

export function getLegendEntry(key: LegendKey): LegendEntry | undefined {
  return ENTRY_BY_KEY.get(key)
}

export const LEGEND_GROUPS: LegendGroup[] = [
  { title: 'CMS Care Compare (SNFs)', keys: ['snf-beds', 'snf-occupancy', 'snf-overall-rating', 'snf-sub-ratings', 'snf-ownership', 'snf-sff'] },
  { title: 'CMS Hospital General Information', keys: ['hospital-type', 'hospital-overall-rating', 'hospital-emergency'] },
  { title: 'CMS Provider of Services file', keys: ['hospital-beds'] },
  { title: 'CMS HCRIS cost reports', keys: ['cost-report-occupancy', 'cost-report-margin', 'cost-report-payer-mix', 'cost-report-status', 'cost-report-trend'] },
  { title: 'Computed in-app', keys: ['distance', 'map-location'] }
]
