export type CsvRow = Record<string, string | number | null | undefined>

function escapeCsv(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowsToCsv(headers: string[], rows: CsvRow[]): string {
  const lines = [headers.map(escapeCsv).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(','))
  }
  return lines.join('\n')
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function copyTableToClipboard(headers: string[], rows: CsvRow[]): Promise<void> {
  const lines = [headers.join('\t')]
  for (const row of rows) {
    lines.push(headers.map((h) => String(row[h] ?? '')).join('\t'))
  }
  await navigator.clipboard.writeText(lines.join('\n'))
}
