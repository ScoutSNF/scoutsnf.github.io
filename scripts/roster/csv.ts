/** Minimal RFC4180 CSV parser: handles quoted fields, embedded commas/newlines, "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length

  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += c
    i++
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

/** Normalizes a header/key for fuzzy matching: lowercase, alnum-only, single underscores. */
export function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export interface CsvTable {
  headers: string[]
  normalizedHeaders: string[]
  rows: string[][]
}

export function parseCsvTable(text: string): CsvTable {
  const all = parseCsv(text)
  const headers = all[0] ?? []
  return {
    headers,
    normalizedHeaders: headers.map(normalizeKey),
    rows: all.slice(1)
  }
}

/** Finds the column index matching any of the given normalized candidate names. */
export function findColumn(table: CsvTable, candidates: string[]): number {
  const normCandidates = candidates.map(normalizeKey)
  for (const cand of normCandidates) {
    const idx = table.normalizedHeaders.indexOf(cand)
    if (idx !== -1) return idx
  }
  // fallback: substring match
  for (const cand of normCandidates) {
    const idx = table.normalizedHeaders.findIndex((h) => h.includes(cand))
    if (idx !== -1) return idx
  }
  return -1
}

export function parseNum(v: string | undefined | null): number | null {
  if (v == null) return null
  const trimmed = v.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}
