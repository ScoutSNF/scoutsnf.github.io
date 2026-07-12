import ExcelJS from 'exceljs'

export const EXCEL_COLORS = {
  teal: 'FF0F4C5C',
  white: 'FFFFFFFF',
  ink: 'FF1E293B',
  muted: 'FF64748B',
  border: 'FFE2E8F0',
  zebra: 'FFF8FAFC',
  amber2: 'FFFDEBC8',
  amber3plus: 'FFF7C873'
}

export function thinBorder(): Partial<ExcelJS.Borders> {
  const side: ExcelJS.Border = { style: 'thin', color: { argb: EXCEL_COLORS.border } }
  return { top: side, bottom: side, left: side, right: side }
}

export function styleHeaderRow(row: ExcelJS.Row, fill = EXCEL_COLORS.teal, font = EXCEL_COLORS.white) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: font }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    cell.border = thinBorder()
  })
  row.height = 28
}

export function addTitle(sheet: ExcelJS.Worksheet, text: string, cols: number) {
  sheet.mergeCells(1, 1, 1, cols)
  const cell = sheet.getCell(1, 1)
  cell.value = text
  cell.font = { bold: true, size: 15, color: { argb: EXCEL_COLORS.teal } }
  cell.alignment = { vertical: 'middle' }
  sheet.getRow(1).height = 26
}

export function addSubtitle(sheet: ExcelJS.Worksheet, rowIndex: number, text: string, cols: number) {
  sheet.mergeCells(rowIndex, 1, rowIndex, cols)
  const cell = sheet.getCell(rowIndex, 1)
  cell.value = text
  cell.font = { italic: true, size: 10, color: { argb: EXCEL_COLORS.muted } }
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

export function addTable(
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
    const fill = customFill ?? (i % 2 === 1 ? EXCEL_COLORS.zebra : EXCEL_COLORS.white)
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      cell.border = thinBorder()
      cell.font = { color: { argb: EXCEL_COLORS.ink }, size: 10.5 }
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
    row.height = Math.max(18, maxLines * 14)
  })

  if (rows.length === 0) {
    const row = sheet.getRow(startRow + 1)
    row.getCell(1).value = 'None'
    row.getCell(1).font = { italic: true, color: { argb: EXCEL_COLORS.muted }, size: 10.5 }
    sheet.mergeCells(startRow + 1, 1, startRow + 1, headers.length)
    return startRow + 2
  }

  return startRow + 1 + rows.length + 1
}

export function ratingValue(rating: number | null): string {
  return rating != null ? rating.toFixed(1) : '—'
}

/** Landscape + fit-to-width so a wide table doesn't get clipped on print or export to PDF/image. */
export function applyPageSetup(sheet: ExcelJS.Worksheet) {
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
  }
}

export function newWorkbook(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ScoutSNF'
  wb.created = new Date()
  return wb
}

export async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
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
