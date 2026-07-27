import type { PortfolioReportData } from './portfolioReport'
import type { PortfolioClusterResult, MarketFacility } from './portfolioClusters'
import type { Portfolio } from '../types/facility'
import { getBedsDisplay, getOccupancyDisplay } from './facilityDisplay'
import {
  EXCEL_COLORS,
  addTitle,
  addSubtitle,
  addTable,
  ratingValue,
  applyPageSetup,
  newWorkbook,
  workbookToBlob
} from './excelStyle'

export { downloadBlob } from './excelStyle'

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

export async function buildPortfolioWorkbook(
  portfolio: Portfolio,
  data: PortfolioReportData,
  clusterResult: PortfolioClusterResult,
  clusterThresholdMiles: number,
  competitorRadiusMiles: number
): Promise<Blob> {
  const wb = newWorkbook()

  // --- Summary sheet ---
  const summary = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] })
  applyPageSetup(summary)
  summary.columns = [{ width: 38 }, { width: 18 }, { width: 8 }, { width: 9 }, { width: 12 }, { width: 9 }]
  addTitle(summary, `Portfolio report: ${portfolio.name}`, 6)
  addSubtitle(
    summary,
    2,
    `Generated ${new Date().toLocaleString()} · ${data.members.length} facilit${data.members.length === 1 ? 'y' : 'ies'}${
      data.statesCovered.length > 0 ? ` · ${data.statesCovered.join(', ')}` : ''
    } · clusters at ${clusterThresholdMiles} mi, competitors within ${competitorRadiusMiles} mi`,
    6
  )

  addTable(
    summary,
    4,
    ['Name', 'City', 'State', 'Beds', 'Occupancy', 'Rating'],
    data.members.map((m) => {
      const occ = getOccupancyDisplay(m.facility)
      return [m.row.name, m.row.city, m.row.state, getBedsDisplay(m.facility), occ.text, ratingValue(m.facility.overallRating)]
    })
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
  const usedNames = new Set<string>(['summary', 'clusters', 'standalones'])
  for (const cluster of clusterResult.clusters) {
    const sheetName = uniqueSheetName(cluster.name, usedNames)
    const sheet = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] })
    applyPageSetup(sheet)
    sheet.columns = [{ width: 34 }, { width: 16 }, { width: 8 }, { width: 9 }, { width: 12 }, { width: 9 }]
    addTitle(sheet, cluster.name, 6)
    addSubtitle(
      sheet,
      2,
      `${cluster.members.length} facilit${cluster.members.length === 1 ? 'y' : 'ies'} · ${cluster.totalBeds} total beds${
        cluster.weightedOccupancy != null ? ` · ${cluster.weightedOccupancy}% avg occupancy` : ''
      }`,
      6
    )

    let r = 4
    sheet.getCell(r, 1).value = 'Members'
    sheet.getCell(r, 1).font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.teal } }
    r += 1
    r = addTable(
      sheet,
      r,
      ['Name', 'City', 'State', 'Beds', 'Occupancy', 'Rating'],
      cluster.members.map((m) => {
        const occ = getOccupancyDisplay(m.facility)
        return [m.row.name, m.row.city, m.row.state, getBedsDisplay(m.facility), occ.text, ratingValue(m.facility.overallRating)]
      })
    )

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

  // --- Standalones sheet ---
  const standalonesSheet = wb.addWorksheet('Standalones', { views: [{ showGridLines: false }] })
  applyPageSetup(standalonesSheet)
  standalonesSheet.columns = [{ width: 34 }, { width: 16 }, { width: 8 }, { width: 9 }, { width: 12 }, { width: 9 }, { width: 34 }, { width: 13 }]
  addTitle(standalonesSheet, 'Standalone facilities', 8)
  addSubtitle(standalonesSheet, 2, `Portfolio facilities not within ${clusterThresholdMiles} mi of any other portfolio facility.`, 8)
  addTable(
    standalonesSheet,
    4,
    ['Name', 'City', 'State', 'Beds', 'Occupancy', 'Rating', 'Nearest Portfolio Facility', 'Distance (mi)'],
    clusterResult.standalones.map((s) => {
      const occ = getOccupancyDisplay(s.member.facility)
      return [
        s.member.row.name,
        s.member.row.city,
        s.member.row.state,
        getBedsDisplay(s.member.facility),
        occ.text,
        ratingValue(s.member.facility.overallRating),
        s.hasLocation ? (s.nearestPortfolioMember?.row.name ?? 'N/A') : 'No location data',
        s.nearestPortfolioMiles ?? 'N/A'
      ]
    })
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
