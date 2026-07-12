export type CsvRow = Record<string, string | number | null | undefined>

export async function copyTableToClipboard(headers: string[], rows: CsvRow[]): Promise<void> {
  const lines = [headers.join('\t')]
  for (const row of rows) {
    lines.push(headers.map((h) => String(row[h] ?? '')).join('\t'))
  }
  await navigator.clipboard.writeText(lines.join('\n'))
}
