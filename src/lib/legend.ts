export type LegendKey =
  | 'snf-beds'
  | 'snf-occupancy'
  | 'snf-overall-rating'
  | 'snf-sub-ratings'
  | 'snf-ownership'
  | 'snf-sff'
  | 'snf-sff-candidate'
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
  /**
   * Shown in place of `details` when the value on screen is N/A. "From Worksheet G/G-2/G-3" tells
   * a reader where a number would have come from but nothing about why it is absent, which is the
   * only question worth answering at the moment they are looking at a blank.
   */
  whenMissing?: string
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
    stat: 'Special Focus Facility',
    source: 'CMS Care Compare',
    refresh: '~monthly',
    details: 'Currently in the SFF program — surveyed about twice as often, with termination exposure'
  },
  {
    key: 'snf-sff-candidate',
    stat: 'SFF Candidate',
    source: 'CMS Care Compare',
    refresh: '~monthly',
    details: 'On the SFF watch list and eligible for selection, but not in the program'
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
    details:
      'Total patient days ÷ (beds × days in the fiscal year). A fiscal-year average, so it will differ from the Care Compare occupancy above, which is a recent daily census.',
    whenMissing:
      'This facility\u2019s filed cost report has no usable patient-day or bed count, so the ratio cannot be computed. It is missing from the filing, not zero.'
  },
  {
    key: 'cost-report-margin',
    stat: 'Operating margin',
    source: 'CMS HCRIS cost reports',
    refresh: 'Quarterly',
    details:
      '(Net patient revenue − total operating expenses) ÷ net patient revenue, from Worksheet G/G-2/G-3. Negative means the facility spent more on operations than it collected.',
    whenMissing:
      'Shown as N/A because this facility\u2019s filing is missing the revenue figures the ratio needs — commonly the case for reports filed as a group or with an incomplete Worksheet G. Expenses alone cannot produce a margin, so nothing is estimated.'
  },
  {
    key: 'cost-report-payer-mix',
    stat: 'Payer mix (Medicare/Medicaid/other)',
    source: 'CMS HCRIS cost reports',
    refresh: 'Quarterly',
    details: 'Share of total patient days by payer, from Worksheet S-3 Pt I — days, not dollars',
    whenMissing: 'This filing does not break patient days out by payer, so the split cannot be derived.'
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
    stat: 'Fiscal-year trend',
    source: 'Derived in-app',
    refresh: 'Derived',
    details:
      'Built from the cost-report stats above, one point per fiscal year on file. The heading names the actual years charted, which may be fewer than three.'
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
  {
    title: 'CMS Care Compare (SNFs)',
    keys: ['snf-beds', 'snf-occupancy', 'snf-overall-rating', 'snf-sub-ratings', 'snf-ownership', 'snf-sff', 'snf-sff-candidate']
  },
  { title: 'CMS Hospital General Information', keys: ['hospital-type', 'hospital-overall-rating', 'hospital-emergency'] },
  { title: 'CMS Provider of Services file', keys: ['hospital-beds'] },
  { title: 'CMS HCRIS cost reports', keys: ['cost-report-occupancy', 'cost-report-margin', 'cost-report-payer-mix', 'cost-report-status', 'cost-report-trend'] },
  { title: 'Computed in-app', keys: ['distance', 'map-location'] }
]
