import type { PortfolioReportData } from './portfolioReport'
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

function memberId(m: PortfolioReportData['members'][number]): string {
  return `${m.facility.kind}:${m.facility.ccn}`
}

export async function buildPortfolioWorkbook(portfolio: Portfolio, data: PortfolioReportData): Promise<Blob> {
  const wb = newWorkbook()

  // --- Summary sheet ---
  const summary = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] })
  applyPageSetup(summary)
  summary.columns = [{ width: 38 }, { width: 18 }, { width: 8 }, { width: 9 }, { width: 12 }, { width: 9 }, { width: 15 }]
  addTitle(summary, `Portfolio report: ${portfolio.name}`, 7)
  addSubtitle(
    summary,
    2,
    `Generated ${new Date().toLocaleString()} · ${data.members.length} facilit${data.members.length === 1 ? 'y' : 'ies'}${
      data.statesCovered.length > 0 ? ` · ${data.statesCovered.join(', ')}` : ''
    }`,
    7
  )

  let row = 4
  summary.getCell(row, 1).value = 'Facilities in this portfolio'
  summary.getCell(row, 1).font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.teal } }
  row += 1
  row = addTable(
    summary,
    row,
    ['Name', 'City', 'State', 'Beds', 'Occupancy', 'Rating', 'Saved Radius (mi)'],
    data.members.map((m) => {
      const occ = getOccupancyDisplay(m.facility)
      return [m.row.name, m.row.city, m.row.state, getBedsDisplay(m.facility), occ.text, ratingValue(m.facility.overallRating), m.row.radiusMiles]
    })
  )

  row += 1
  if (data.distances.length > 0) {
    summary.getCell(row, 1).value = 'Distance between your facilities'
    summary.getCell(row, 1).font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.teal } }
    row += 1
    row = addTable(
      summary,
      row,
      ['Facility A', 'Facility B', 'Distance (mi)'],
      data.distances.map((d) => [d.a.row.name, d.b.row.name, d.distanceMiles])
    )
  }

  // --- Shared competitors sheet ---
  const shared = wb.addWorksheet('Shared Competitors', { views: [{ showGridLines: false }] })
  applyPageSetup(shared)
  shared.columns = [{ width: 38 }, { width: 18 }, { width: 8 }, { width: 14 }, { width: 55 }]
  addTitle(shared, 'Competitors shared by 2+ of your facilities', 5)
  addSubtitle(
    shared,
    2,
    `${data.uniqueCompetitorCount} unique competitor${data.uniqueCompetitorCount === 1 ? '' : 's'} total across the portfolio — rows shaded darker are near more of your facilities.`,
    5
  )
  addTable(
    shared,
    4,
    ['Competitor', 'City', 'State', '# Your Facilities Near', 'Distance to Each'],
    data.sharedCompetitors.map((c) => [
      c.facility.name,
      c.facility.city,
      c.facility.state,
      c.near.length,
      c.near.map((n) => `${n.member.row.name} (${n.distanceMiles} mi)`).join('; ')
    ]),
    {
      rowFill: (values) => {
        const count = values[3] as number
        if (count >= 3) return EXCEL_COLORS.amber3plus
        if (count === 2) return EXCEL_COLORS.amber2
        return undefined
      }
    }
  )

  // --- Shared hospitals sheet ---
  const sharedHospitals = wb.addWorksheet('Shared Hospitals', { views: [{ showGridLines: false }] })
  applyPageSetup(sharedHospitals)
  sharedHospitals.columns = [{ width: 38 }, { width: 18 }, { width: 8 }, { width: 14 }, { width: 55 }]
  addTitle(sharedHospitals, 'Hospitals shared by 2+ of your facilities', 5)
  addSubtitle(
    sharedHospitals,
    2,
    `${data.uniqueHospitalCount} unique hospital${data.uniqueHospitalCount === 1 ? '' : 's'} total across the portfolio — rows shaded darker are near more of your facilities.`,
    5
  )
  addTable(
    sharedHospitals,
    4,
    ['Hospital', 'City', 'State', '# Your Facilities Near', 'Distance to Each'],
    data.sharedHospitals.map((h) => [
      h.facility.name,
      h.facility.city,
      h.facility.state,
      h.near.length,
      h.near.map((n) => `${n.member.row.name} (${n.distanceMiles} mi)`).join('; ')
    ]),
    {
      rowFill: (values) => {
        const count = values[3] as number
        if (count >= 3) return EXCEL_COLORS.amber3plus
        if (count === 2) return EXCEL_COLORS.amber2
        return undefined
      }
    }
  )

  // --- One sheet per facility ---
  const usedNames = new Set<string>()
  for (const m of data.members) {
    const competitors = data.competitorsByMemberId.get(memberId(m)) ?? []
    const nearbyHospitals = data.hospitalsByMemberId.get(memberId(m)) ?? []
    let sheetName = m.row.name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 28) || 'Facility'
    let suffix = 2
    while (usedNames.has(sheetName.toLowerCase())) {
      sheetName = `${m.row.name.slice(0, 24)} (${suffix})`
      suffix += 1
    }
    usedNames.add(sheetName.toLowerCase())

    const sheet = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] })
    applyPageSetup(sheet)
    sheet.columns = [{ width: 38 }, { width: 18 }, { width: 8 }, { width: 13 }, { width: 9 }, { width: 12 }, { width: 9 }]
    addTitle(sheet, `Near ${m.row.name}`, 7)
    addSubtitle(sheet, 2, `Within the saved ${m.row.radiusMiles} mi search radius of ${m.row.name}, ${m.row.city}, ${m.row.state}.`, 7)

    let facRow = 4
    sheet.getCell(facRow, 1).value = 'Competing SNFs'
    sheet.getCell(facRow, 1).font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.teal } }
    facRow += 1
    facRow = addTable(
      sheet,
      facRow,
      ['Name', 'City', 'State', 'Distance (mi)', 'Beds', 'Occupancy', 'Rating'],
      competitors.map((c) => {
        const occ = getOccupancyDisplay(c.facility)
        return [c.facility.name, c.facility.city, c.facility.state, c.distanceMiles, getBedsDisplay(c.facility), occ.text, ratingValue(c.facility.overallRating)]
      })
    )

    facRow += 1
    sheet.getCell(facRow, 1).value = 'Hospitals'
    sheet.getCell(facRow, 1).font = { bold: true, size: 12, color: { argb: EXCEL_COLORS.teal } }
    facRow += 1
    addTable(
      sheet,
      facRow,
      ['Name', 'City', 'State', 'Distance (mi)', 'Beds', 'Occupancy', 'Rating'],
      nearbyHospitals.map((h) => {
        const occ = getOccupancyDisplay(h.facility)
        return [h.facility.name, h.facility.city, h.facility.state, h.distanceMiles, getBedsDisplay(h.facility), occ.text, ratingValue(h.facility.overallRating)]
      })
    )
  }

  return workbookToBlob(wb)
}
