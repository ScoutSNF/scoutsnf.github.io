import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

/**
 * ALPHA.CSV column order (headerless): RPT_REC_NUM, WKSHT_CD, LINE_NUM, CLMN_NUM, ITM_ALPHANUM.
 * The text counterpart to NMRC: line descriptions and "specify" labels as filed. Much smaller
 * than NMRC, but still streamed line-by-line for symmetry with parseNmrcStream.
 */
const COL = { rptRecNum: 0, wkshtCd: 1, lineNum: 2, clmnNum: 3, label: 4 } as const

/**
 * Streams filePath, keeping only the ALPHA labels of Worksheet G-3 lines 27-30 (the itemized
 * "other expenses" lines, whose label is the filer's own description -- e.g. a facility's
 * income-tax provision). Returns rptRecNum -> lineNum -> label, title-cased for display.
 * Labels are the filer's own text and may be truncated to fit the form field.
 */
export async function parseAlphaOtherExpenseLabels(filePath: string): Promise<Map<string, Map<string, string>>> {
  const wanted = new Set(['02700', '02800', '02900', '03000'])
  const result = new Map<string, Map<string, string>>()
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line) continue
    // ALPHA values are plain text without embedded commas in the lines we keep; a plain split is
    // safe for the same reason as in parseNmrcStream.
    const fields = line.split(',')
    if ((fields[COL.wkshtCd]?.trim() ?? '') !== 'G300000') continue
    const lineNum = fields[COL.lineNum]?.trim() ?? ''
    if (!wanted.has(lineNum)) continue
    const rptRecNum = fields[COL.rptRecNum]?.trim()
    const label = fields[COL.label]?.trim()
    if (!rptRecNum || !label) continue

    const existing = result.get(rptRecNum) ?? new Map<string, string>()
    existing.set(lineNum, label)
    result.set(rptRecNum, existing)
  }

  return result
  }
