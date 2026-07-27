import type ExcelJS from 'exceljs'
import type { PortfolioMemberResolved, PortfolioReportData } from './portfolioReport'
import { CANNIBALIZATION_THRESHOLD_MILES, type PortfolioClusterResult, type MarketFacility } from './portfolioClusters'
import type { Portfolio, SnfRecord, FacilityRecord } from '../types/facility'
import type { FacilityYearRecord } from '../types/costReport'
import { getBedsDisplay, getOccupancyDisplay } from './facilityDisplay'
import {
  EXCEL_COLORS,
  addTitle,
  addSubtitle,
  addTable,
  ratingValue,
  applyPageSetup,
  newWorkbook,
  workbookToBlob,
  styleHeaderRow,
  thinBorder
} from './excelStyle'

export { downloadBlob } from './excelStyle'

function memberKey(m: PortfolioMemberResolved): string {
  return `${m.facility.kind}:${m.facility.ccn}`
}

/** Reads a SNF-only field, falling back for hospitals (which don't have it). */
function snfOnly<T>(f: FacilityRecord, get: (s: SnfRecord) => T, fallback: T): T {
  return f.kind === 'snf' ? get(f) : fallback
}

// Full per-facility detail, shared across the Summary, per-cluster Members, and Standalones
// tables so "every field we have" reads consistently wherever a facility row appears.
const DETAIL_HEADERS = [
  'Name',
  'City',
  'State',
  'Beds',
  'Occupancy',
  'Overall',
  'Address',
  'ZIP',
  'Ownership',
  'SFF',
  'Health Insp.',
  'Staffing',
  'QM',
  'Data As-Of'
]
const DETAIL_WIDTHS = [
  { width: 34 },
  { width: 16 },
  { width: 7 },
  { width: 8 },
  { width: 11 },
  { width: 8 },
  { width: 26 },
  { width: 9 },
  { width: 24 },
  { width: 6 },
  { width: 11 },
  { width: 9 },
  { width: 8 },
  { width: 11 }
]

function detailRow(m: PortfolioMemberResolved): (string | number)[] {
  const f = m.facility
  const occ = getOccupancyDisplay(f)
  return [
    m.row.name,
    m.row.city,
    m.row.state,
    getBedsDisplay(f),
    occ.text,
    ratingValue(f.overallRating),
    f.address,
    f.zip,
    snfOnly(f, (s) => s.ownershipType ?? 'N/A', 'N/A'),
    snfOnly(f, (s) => (s.specialFocusFacility ? 'Yes' : 'No'), 'N/A'),
    snfOnly(f, (s) => ratingValue(s.healthInspectionRating), 'N/A'),
    snfOnly(f, (s) => ratingValue(s.staffingRating), 'N/A'),
    snfOnly(f, (s) => ratingValue(s.qualityMeasureRating), 'N/A'),
    snfOnly(f, (s) => s.processingDate ?? 'N/A', 'N/A')
  ]
}

function marketFacilityRows(items: MarketFacility[]): (string | number)[][] {
  return items.map((m) => [
    m.name,
    m.city,
    m.state,
    m.beds ?? 'N/A',
    m.occupancy != null ? `${m.occupancy}%` : 'N/A',
    ratingValue(m.overallStars),
    m.nearestMemberMiles,
    m.nearestMemberName
  ])
}

const MARKET_HEADERS = ['Name', 'City', 'State', 'Beds', 'Occupancy', 'Rating', 'Distance (mi)', 'Nearest Facility']
const MARKET_WIDTHS = [{ width: 34 }, { width: 16 }, { width: 8 }, { width: 8 }, { width: 11 }, { width: 8 }, { width: 13 }, { width: 26 }]

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US')
}

function formatMoney(n: number): string {
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US')
  return n < 0 ? `-$${abs}` : `$${abs}`
}

const FINANCIALS_HEADERS = [
  'Facility',
  'FY Begin',
  'FY End',
  'Report Status',
  'Beds Available',
  'Total Patient Days',
  'Medicare Days',
  'Medicaid Days',
  'Other Days',
  'Occupancy %',
  'Medicare %',
  'Medicaid %',
  'Other %',
  'Total Patient Revenue',
  'Net Patient Revenue',
  'Total Op Expenses',
  'Net Income',
  'Op Margin %'
]

function financialsRows(members: PortfolioMemberResolved[], costReportsByCcn: Map<string, FacilityYearRecord[]>): (string | number)[][] {
  const rows: (string | number)[][] = []
  for (const m of members) {
    const records = [...(costReportsByCcn.get(m.facility.ccn) ?? [])].sort((a, b) => a.fyBeginDate.localeCompare(b.fyBeginDate))
    if (records.length === 0) {
      rows.push([m.row.name, 'No cost report data on file', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
      continue
    }
    for (const rec of records) {
      rows.push([
        m.row.name,
        formatDate(rec.fyBeginDate),
        formatDate(rec.fyEndDate),
        rec.reportStatusLabel,
        rec.bedsAvailable ?? 'N/A',
        rec.totalPatientDays ?? 'N/A',
        rec.medicarePatientDays ?? 'N/A',
        rec.medicaidPatientDays ?? 'N/A',
        rec.otherPatientDays ?? 'N/A',
        rec.occupancyPct != null ? `${rec.occupancyPct}%` : 'N/A',
        rec.medicarePct != null ? `${rec.medicarePct}%` : 'N/A',
        rec.medicaidPct != null ? `${rec.medicaidPct}%` : 'N/A',
        rec.otherPct != null ? `${rec.otherPct}%` : 'N/A',
        rec.totalPatientRevenue != null ? formatMoney(rec.totalPatientRevenue) : 'N/A',
        rec.netPatientRevenue != null ? formatMoney(rec.netPatientRevenue) : 'N/A',
        rec.totalOperatingExpenses != null ? formatMoney(rec.totalOperatingExpenses) : 'N/A',
        rec.netIncome != null ? formatMoney(rec.netIncome) : 'N/A',
        rec.operatingMarginPct != null ? `${rec.operatingMarginPct}%` : 'N/A'
      ])
    }
  }
  return rows
}

/** Upper-triangle mile matrix between every two portfolio members, shaded within cannibalization range. */
function addDistanceMatrix(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  members: PortfolioMemberResolved[],
  lookup: Map<string, number>
): void {
  const headerRow = sheet.getRow(startRow)
  headerRow.getCell(1).value = ''
  members.forEach((_, i) => (headerRow.getCell(i + 2).value = i + 1))
  styleHeaderRow(headerRow)

  members.forEach((m, i) => {
    const row = sheet.getRow(startRow + 1 + i)
    const labelCell = row.getCell(1)
    labelCell.value = `${i + 1}. ${m.row.name}`
    labelCell.font = { bold: true, color: { argb: EXCEL_COLORS.ink }, size: 10.5 }
    labelCell.border = thinBorder()
    labelCell.alignment = { vertical: 'middle', wrapText: true }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.white } }

    members.forEach((other, j) => {
      const cell = row.getCell(j + 2)
      cell.border = thinBorder()
      cell.alignment = { vertical: 'middle', horizontal: 'right' }
      if (j <= i) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.zebra } }
        return
      }
      const dist = lookup.get(`${memberKey(m)}|${memberKey(other)}`)
      cell.value = dist ?? 'N/A'
      cell.font = { color: { argb: EXCEL_COLORS.ink }, size: 10.5 }
      const fill = dist != null && dist <= CANNIBALIZATION_THRESHOLD_MILES ? EXCEL_COLORS.amber3plus : EXCEL_COLORS.white
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    })
    row.height = 18
  })
}

export async function buildPortfolioWorkbook(
  portfolio: Portfolio,
  data: PortfolioReportData,
  clusterResult: PortfolioClusterResult,
  clusterThresholdMiles: number,
  competitorRadiusMiles: number,
  costReportsByCcn: Map<string, FacilityYearRecord[]>
): Promise<Blob> {
  const wb = newWorkbook()

  const clusterByMemberId = new Map<string, string>()
  for (const c of clusterResult.clusters) {
    for (const m of c.members) clusterByMemberId.set(memberKey(m), c.name)
  }

  // --- Summary sheet ---
  const summary = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] })
  applyPageSetup(summary)
  summary.columns = [...DETAIL_WIDTHS, { width: 18 }]
  addTitle(summary, `Portfolio report: ${portfolio.name}`, DETAIL_HEADERS.length + 1)
  addSubtitle(
    summary,
    2,
    `Generated ${new Date().toLocaleString()} · ${data.members.length} facilit${data.members.length === 1 ? 'y' : 'ies'}${
      data.statesCovered.length > 0 ? ` · ${data.statesCovered.join(', ')}` : ''
    } · clusters at ${clusterThresholdMiles} mi, competitors within ${competitorRadiusMiles} mi`,
    DETAIL_HEADERS.length + 1
  )

  addTable(
    summary,
    4,
    [...DETAIL_HEADERS, 'Cluster'],
    data.members.map((m) => [...detailRow(m), clusterByMemberId.get(memberKey(m)) ?? 'Standalone'])
  )

  // --- Clusters summary sheet ---
  const clustersSheet = wb.addWorksheet('Clusters', { views: [{ showGridLines: false }] })
  applyPageSetup(clustersSheet)
  clustersSheet.columns = [{ width: 30 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 55 }]
  addTitle(clustersSheet, 'Market clusters', 5)
  addSubtitle(
    clustersSheet,
    2,
    `Portfolio facilities within ${clusterThresholdMiles} mi of each other, grouped transitively. See the per-cluster sheets for members and nearby market facilities.`,
    5
  )
  addTable(
    clustersSheet,
    4,
    ['Cluster', 'Facilities', 'Total Beds', 'Avg Occupancy', 'Cannibalization Flags'],
    clusterResult.clusters.map((c) => [
      c.name,
      c.members.length,
      c.totalBeds,
      c.weightedOccupancy != null ? `${c.weightedOccupancy}%` : 'N/A',
      c.cannibalizationPairs.length > 0
        ? c.cannibalizationPairs.map((p) => `${p.memberA.row.name} ↔ ${p.memberB.row.name} (${p.miles} mi)`).join('; ')
        : 'None'
    ]),
    {
      rowFill: (values) => {
        const flags = values[4] as string
        return flags !== 'None' ? EXCEL_COLORS.amber2 : undefined
      }
    }
  )

  // --- One sheet per cluster ---
  const usedNames = new Set<string>(['summary', 'clusters', 'financials', 'distances', 'standalones'])
  for (const cluster of clusterResult.clusters) {
    const sheetName = uniqueSheetName(cluster.name, usedNames)
    const sheet = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] })
    applyPageSetup(sheet)
    sheet.columns = [...DETAIL_WIDTHS]
    addTitle(sheet, cluster.name, DETAIL_HEADERS.length)
    addSubtitle(
      sheet,
      2,
      `${cluster.members.length} facilit${cluster.members.length === 1 ? 'y' : 'ies'} · ${cluster.totalBeds} total beds${
        cluster.weightedOccupancy != null ? ` · ${cluster.weightedOccupancy}% avg occupancy` : ''
      }`,
      DETAIL_HEADERS.length
    )

    let r = 4
    sheet.getCell(r, 1).value = 'Members'
    sheet.getCell(r, 1).font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.teal } }
    r += 1
    r = addTable(sheet, r, DETAIL_HEADERS, cluster.members.map(detailRow))

    if (cluster.cannibalizationPairs.length > 0) {
      sheet.getCell(r, 1).value = 'Cannibalization flags'
      sheet.getCell(r, 1).font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.teal } }
      r += 1
      r = addTable(
        sheet,
        r,
        ['Facility A', 'Facility B', 'Distance (mi)'],
        cluster.cannibalizationPairs.map((p) => [p.memberA.row.name, p.memberB.row.name, p.miles])
      )
    }

    sheet.getCell(r, 1).value = `Market intruders (within ${competitorRadiusMiles} mi)`
    sheet.getCell(r, 1).font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.teal } }
    r += 1
    for (let i = 0; i < MARKET_WIDTHS.length; i++) sheet.getColumn(i + 1).width = Math.max(sheet.getColumn(i + 1).width ?? 0, MARKET_WIDTHS[i].width)
    r = addTable(sheet, r, MARKET_HEADERS, marketFacilityRows(cluster.intruders))

    sheet.getCell(r, 1).value = `Referral hospitals (within ${competitorRadiusMiles} mi)`
    sheet.getCell(r, 1).font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.teal } }
    r += 1
    addTable(sheet, r, MARKET_HEADERS, marketFacilityRows(cluster.referralHospitals))
  }

  // --- Financials sheet ---
  const financialsSheet = wb.addWorksheet('Financials', { views: [{ showGridLines: false }] })
  applyPageSetup(financialsSheet)
  financialsSheet.columns = FINANCIALS_HEADERS.map((h, i) => ({ width: i === 0 ? 34 : Math.max(12, h.length + 2) }))
  addTitle(financialsSheet, 'Financials (HCRIS cost reports)', FINANCIALS_HEADERS.length)
  addSubtitle(financialsSheet, 2, 'One row per facility per fiscal year, oldest first.', FINANCIALS_HEADERS.length)
  addTable(financialsSheet, 4, FINANCIALS_HEADERS, financialsRows(data.members, costReportsByCcn))

  // --- Distances sheet ---
  const distancesSheet = wb.addWorksheet('Distances', { views: [{ showGridLines: false }] })
  applyPageSetup(distancesSheet)
  distancesSheet.columns = [{ width: 34 }, ...data.members.map(() => ({ width: 8 }))]
  addTitle(distancesSheet, 'Portfolio distances', data.members.length + 1)
  addSubtitle(
    distancesSheet,
    2,
    `Straight-line miles between every two portfolio facilities. Shaded within ${CANNIBALIZATION_THRESHOLD_MILES} mi (cannibalization range).`,
    data.members.length + 1
  )
  const distanceLookup = new Map<string, number>()
  for (const d of data.distances) {
    distanceLookup.set(`${memberKey(d.a)}|${memberKey(d.b)}`, d.distanceMiles)
    distanceLookup.set(`${memberKey(d.b)}|${memberKey(d.a)}`, d.distanceMiles)
  }
  addDistanceMatrix(distancesSheet, 4, data.members, distanceLookup)

  // --- Standalones sheet ---
  const standalonesSheet = wb.addWorksheet('Standalones', { views: [{ showGridLines: false }] })
  applyPageSetup(standalonesSheet)
  standalonesSheet.columns = [...DETAIL_WIDTHS, { width: 34 }, { width: 13 }]
  addTitle(standalonesSheet, 'Standalone facilities', DETAIL_HEADERS.length + 2)
  addSubtitle(standalonesSheet, 2, `Portfolio facilities not within ${clusterThresholdMiles} mi of any other portfolio facility.`, DETAIL_HEADERS.length + 2)
  addTable(
    standalonesSheet,
    4,
    [...DETAIL_HEADERS, 'Nearest Portfolio Facility', 'Distance (mi)'],
    clusterResult.standalones.map((s) => [
      ...detailRow(s.member),
      s.hasLocation ? (s.nearestPortfolioMember?.row.name ?? 'N/A') : 'No location data',
      s.nearestPortfolioMiles ?? 'N/A'
    ])
  )

  return workbookToBlob(wb)
}

function uniqueSheetName(name: string, used: Set<string>): string {
  let sheetName = name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 28) || 'Cluster'
  let suffix = 2
  while (used.has(sheetName.toLowerCase())) {
    sheetName = `${name.slice(0, 24)} (${suffix})`
    suffix += 1
  }
  used.add(sheetName.toLowerCase())
  return sheetName
}
