import ExcelJS from 'exceljs'
import type { PortfolioReportData } from './portfolioReport'
import type { Portfolio } from '../types/facility'
import { getBedsDisplay, getOccupancyDisplay } from './facilityDisplay'

const TEAL = 'FF0F4C5C'
const WHITE = 'FFFFFFFF'
const INK = 'FF1E293B'
const MUTED = 'FF64748B'
const BORDER = 'FFE2E8F0'
const ZEBRA = 'FFF8FAFC'
const AMBER_2 = 'FFFDEBC8'
const AMBER_3PLUS = 'FFF7C873'

function memberId(m: PortfolioReportData['members'][number]): string {
  return `${m.facility.kind}:${m.facility.ccn}`
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: ExcelJS.Border = { style: 'thin', color: { argb: BORDER } }
  return { top: side, bottom: side, left: side, right: side }
}

function styleHeaderRow(row: ExcelJS.Row, fill = TEAL, font = WHITE) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: font }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = thinBorder()
  })
  row.height = 28
}

function addTitle(sheet: ExcelJS.Worksheet, text: string, cols: number) {
  sheet.mergeCells(1, 1, 1, cols)
  const cell = sheet.getCell(1, 1)
  cell.value = text
  cell.font = { bold: true, size: 15, color: { argb: TEAL } }
  cell.alignment = { vertical: 'middle' }
  sheet.getRow(1).height = 26
}

function addSubtitle(sheet: ExcelJS.Worksheet, rowIndex: number, text: string, cols: number) {
  sheet.mergeCells(rowIndex, 1, rowIndex, cols)
  const cell = sheet.getCell(rowIndex, 1)
  cell.value = text
  cell.font = { italic: true, size: 10, color: { argb: MUTED } }
}

/** Rough estimate of characters that fit on one line of an Excel column at this width. */
function charsPerLine(colWidth: number): number {
  return Math.max(4, Math.floor(colWidth * 1.8))
}

/** Column widths, read back off the sheet, in the same order cells are written. */
function columnWidths(sheet: ExcelJS.Worksheet, count: number): number[] {
  const widths: number[] = []
  for (let i = 1; i <= count; i++) {
    widths.push(sheet.getColumn(i).width ?? 12)
  }
  return widths
}

function addTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  headers: string[],
  rows: (string | number)[][],
  opts?: { rowFill?: (rowValues: (string | number)[], index: number) => string | undefined }
): number {
  const widths = columnWidths(sheet, headers.length)

  const headerRow = sheet.getRow(startRow)
  headers.forEach((h, i) => (headerRow.getCell(i + 1).value = h))
  styleHeaderRow(headerRow)

  rows.forEach((values, i) => {
    const row = sheet.getRow(startRow + 1 + i)
    let maxLines = 1
    values.forEach((v, ci) => {
      row.getCell(ci + 1).value = v
      const lines = Math.ceil(String(v).length / charsPerLine(widths[ci] ?? 12))
      if (lines > maxLines) maxLines = lines
    })
    const customFill = opts?.rowFill?.(values, i)
    const fill = customFill ?? (i % 2 === 1 ? ZEBRA : WHITE)
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      cell.border = thinBorder()
      cell.font = { color: { argb: INK }, size: 10.5 }
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
    row.height = Math.max(18, maxLines * 14)
  })

  if (rows.length === 0) {
    const row = sheet.getRow(startRow + 1)
    row.getCell(1).value = 'None'
    row.getCell(1).font = { italic: true, color: { argb: MUTED }, size: 10.5 }
    sheet.mergeCells(startRow + 1, 1, startRow + 1, headers.length)
    return startRow + 2
  }

  return startRow + 1 + rows.length + 1
}

function ratingValue(rating: number | null): string {
  return rating != null ? rating.toFixed(1) : '—'
}

/** Landscape + fit-to-width so a wide table doesn't get clipped on print or export to PDF/image. */
function applyPageSetup(sheet: ExcelJS.Worksheet) {
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
  }
}

export async function buildPortfolioWorkbook(portfolio: Portfolio, data: PortfolioReportData): Promise<Blob> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ScoutSNF'
  wb.created = new Date()

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
  summary.getCell(row, 1).font = { bold: true, size: 12, color: { argb: TEAL } }
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
    summary.getCell(row, 1).font = { bold: true, size: 12, color: { argb: TEAL } }
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
        if (count >= 3) return AMBER_3PLUS
        if (count === 2) return AMBER_2
        return undefined
      }
    }
  )

  // --- One sheet per facility ---
  const usedNames = new Set<string>()
  for (const m of data.members) {
    const competitors = data.competitorsByMemberId.get(memberId(m)) ?? []
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
    addTitle(sheet, `Competitors near ${m.row.name}`, 7)
    addSubtitle(sheet, 2, `Within the saved ${m.row.radiusMiles} mi search radius of ${m.row.name}, ${m.row.city}, ${m.row.state}.`, 7)
    addTable(
      sheet,
      4,
      ['Name', 'City', 'State', 'Distance (mi)', 'Beds', 'Occupancy', 'Rating'],
      competitors.map((c) => {
        const occ = getOccupancyDisplay(c.facility)
        return [c.facility.name, c.facility.city, c.facility.state, c.distanceMiles, getBedsDisplay(c.facility), occ.text, ratingValue(c.facility.overallRating)]
      })
    )
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
