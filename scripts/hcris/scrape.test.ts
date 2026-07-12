import { describe, expect, it } from 'vitest'
import { findSnfZipLinks, mostRecentFiscalYears } from './scrape.js'

const SAMPLE_HTML = `
<html><body>
<h2>Cost Reports by Fiscal Year</h2>
<ul>
  <li><a href="/files/zip/snf10fy2025.zip">SNF FY 2025 (ZIP)</a></li>
  <li><a href="/files/zip/snf10fy2024.zip">SNF FY 2024 (ZIP)</a></li>
  <li><a href="/files/zip/snf10fy2023.zip">SNF FY 2023 (ZIP)</a></li>
  <li><a href="/files/zip/snf10fy2022.zip">SNF FY 2022 (ZIP)</a></li>
  <li><a href="/files/zip/hosp10fy2025.zip">Hospital FY 2025 (ZIP)</a></li>
  <li><a href="/files/pdf/snf-instructions.pdf">SNF Cost Report Instructions</a></li>
</ul>
</body></html>
`

describe('findSnfZipLinks', () => {
  it('extracts only SNF zip links, resolved to absolute URLs, one per year', async () => {
    const links = await findSnfZipLinks(SAMPLE_HTML, 'https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year')
    const years = links.map((l) => l.fiscalYear).sort()
    expect(years).toEqual([2022, 2023, 2024, 2025])
    const fy2025 = links.find((l) => l.fiscalYear === 2025)!
    expect(fy2025.url).toBe('https://www.cms.gov/files/zip/snf10fy2025.zip')
    // The hospital zip and the PDF must not be picked up.
    expect(links.some((l) => l.url.includes('hosp10'))).toBe(false)
  })

  it('throws rather than guessing a URL pattern when nothing matches', async () => {
    await expect(findSnfZipLinks('<html><body>no links here</body></html>')).rejects.toThrow(/No SNF cost report zip links found/)
  })
})

describe('mostRecentFiscalYears', () => {
  it('picks the N most recent years by fiscal year descending', async () => {
    const links = await findSnfZipLinks(SAMPLE_HTML)
    const recent = mostRecentFiscalYears(links, 3)
    expect(recent.map((l) => l.fiscalYear)).toEqual([2025, 2024, 2023])
  })
})
