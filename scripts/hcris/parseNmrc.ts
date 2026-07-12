import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { parseNum } from './csvUtil.js'
import { cellKey, type MetricDef, type RawMetricValues } from './types.js'

/**
 * NMRC.CSV column order (headerless): RPT_REC_NUM, WKSHT_CD, LINE_NUM, CLMN_NUM, ITM_VAL_NUM.
 * This file is the largest of the three (every populated line/column of every worksheet of every
 * report) -- stream it line-by-line and only keep rows matching a wanted cell, never buffer the
 * whole file or build a wide table before filtering.
 */
const COL = { rptRecNum: 0, wkshtCd: 1, lineNum: 2, clmnNum: 3, itmValNum: 4 } as const

/**
 * Streams filePath, keeping only cells matching one of `metrics`' (WKSHT_CD, LINE_NUM, CLMN_NUM)
 * coordinates. Returns rptRecNum -> { metricKey: numeric value }.
 */
export async function parseNmrcStream(
  filePath: string,
  metrics: MetricDef[]
): Promise<Map<string, RawMetricValues>> {
  const wanted = new Map<string, string>() // cellKey -> metric key
  for (const m of metrics) wanted.set(cellKey(m.wkshtCd, m.lineNum, m.clmnNum), m.key)

  const result = new Map<string, RawMetricValues>()
  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf8' }), crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line) continue
    // NMRC values are numeric/code fields only -- no embedded commas/quotes expected, so a plain
    // split is safe and much faster than full RFC4180 parsing on a file this size.
    const fields = line.split(',')
    const key = cellKey(fields[COL.wkshtCd]?.trim() ?? '', fields[COL.lineNum]?.trim() ?? '', fields[COL.clmnNum]?.trim() ?? '')
    const metricKey = wanted.get(key)
    if (!metricKey) continue

    const rptRecNum = fields[COL.rptRecNum]?.trim()
    const value = parseNum(fields[COL.itmValNum])
    if (!rptRecNum || value == null) continue

    const existing = result.get(rptRecNum) ?? {}
    existing[metricKey] = value
    result.set(rptRecNum, existing)
  }

  return result
}
