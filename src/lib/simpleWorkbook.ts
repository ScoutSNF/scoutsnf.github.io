import { addTitle, addSubtitle, addTable, applyPageSetup, newWorkbook, workbookToBlob } from './excelStyle'

export { downloadBlob } from './excelStyle'

export async function buildSimpleWorkbook(opts: {
  title: string
  subtitle?: string
  sheetName?: string
  headers: string[]
  columnWidths: number[]
  rows: (string | number)[][]
}): Promise<Blob> {
  const wb = newWorkbook()
  const sheet = wb.addWorksheet(opts.sheetName ?? 'Export', { views: [{ showGridLines: false }] })
  applyPageSetup(sheet)
  sheet.columns = opts.columnWidths.map((width) => ({ width }))
  addTitle(sheet, opts.title, opts.headers.length)
  let row = 2
  if (opts.subtitle) {
    addSubtitle(sheet, 2, opts.subtitle, opts.headers.length)
    row = 3
  }
  addTable(sheet, row, opts.headers, opts.rows)
  return workbookToBlob(wb)
}
