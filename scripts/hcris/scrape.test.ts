import { describe, expect, it, vi } from 'vitest'
import { findSnfFormYearPages, findSnfZipLinkOnPage, findRecentSnfZipLinks, mostRecentFiscalYears } from './scrape.js'

const BASE_URL = 'https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year'

// Shaped after the real index page: it links to per-form-per-year sub-pages, never directly to a
// zip file. Naming is inconsistent across years (snf-2010-fy-2024-data-files vs snf10-2010-fy-2022).
const INDEX_HTML = `
<html><body>
<ul>
  <li><a href="/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year/snf-2010-fy-2025-data-files">SNF-2010 FY 2025</a></li>
  <li><a href="/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year/snf-2010-fy-2024-data-files">SNF-2010 FY 2024</a></li>
  <li><a href="/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year/snf10-2010-fy-2023">SNF-2010 FY 2023</a></li>
  <li><a href="/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year/snf10-2010-fy-2022">SNF-2010 FY 2022</a></li>
  <li><a href="/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year/hospital-2010-fy-2025-1">Hospital-2010 FY 2025</a></li>
  <li><a href="/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year/hha20-fy-2025-data-files">HHA-20 FY 2025</a></li>
  <li><a href="/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year/snf-2024-fy-2025-data-files">SNF-2024 FY 2025 (different form)</a></li>
</ul>
</body></html>
`

// Shaped after the real sub-page: the zip link is inside a "Related Links" block, uses a
// single-quoted href with a stray leading space, and the filename has no separator between "SNF"
// and the digits that follow (e.g. SNF10FY2025.ZIP) -- that no-word-boundary case is the whole
// point of this fixture.
function subPageHtml(filename: string): string {
  return `
<html><body>
<div class="field field--name-field-related-links">
  <ul class="field__items">
    <li class="field__item"><a href=' https://downloads.cms.gov/FILES/HCRIS/${filename}'>${filename}</a></li>
  </ul>
</div>
</body></html>
`
}

describe('findSnfFormYearPages', () => {
  it('extracts only SNF-2010 sub-page links across both naming schemes, one per year', () => {
    const pages = findSnfFormYearPages(INDEX_HTML, BASE_URL)
    const years = pages.map((p) => p.fiscalYear).sort()
    expect(years).toEqual([2022, 2023, 2024, 2025])
    const fy2025 = pages.find((p) => p.fiscalYear === 2025)!
    expect(fy2025.url).toBe(
      'https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year/snf-2010-fy-2025-data-files'
    )
    // Hospital, HHA, and the newer SNF-2024 form revision must not be picked up.
    expect(pages.some((p) => p.url.includes('hospital-2010'))).toBe(false)
    expect(pages.some((p) => p.url.includes('hha20'))).toBe(false)
    expect(pages.some((p) => p.url.includes('snf-2024'))).toBe(false)
  })

  it('throws rather than guessing a URL pattern when nothing matches', () => {
    expect(() => findSnfFormYearPages('<html><body>no links here</body></html>')).toThrow(
      /No SNF-2010 fiscal-year sub-pages found/
    )
  })
})

describe('findSnfZipLinkOnPage', () => {
  it('finds a zip link even with no word boundary between SNF and the trailing digits', () => {
    const zip = findSnfZipLinkOnPage(subPageHtml('SNF10FY2025.ZIP'), BASE_URL)
    expect(zip).not.toBeNull()
    expect(zip!.url).toBe('https://downloads.cms.gov/FILES/HCRIS/SNF10FY2025.ZIP')
  })

  it('returns null when the sub-page has no zip link', () => {
    expect(findSnfZipLinkOnPage('<html><body>nothing here</body></html>', BASE_URL)).toBeNull()
  })
})

describe('mostRecentFiscalYears', () => {
  it('picks the N most recent years by fiscal year descending', () => {
    const pages = findSnfFormYearPages(INDEX_HTML, BASE_URL)
    const recent = mostRecentFiscalYears(pages, 3)
    expect(recent.map((p) => p.fiscalYear)).toEqual([2025, 2024, 2023])
  })
})

describe('findRecentSnfZipLinks', () => {
  it('fetches the index page, then each targeted sub-page, and resolves the real zip URL', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href === BASE_URL) return new Response(INDEX_HTML)
      if (href.includes('fy-2025')) return new Response(subPageHtml('SNF10FY2025.ZIP'))
      if (href.includes('fy-2024')) return new Response(subPageHtml('SNF10FY2024.ZIP'))
      throw new Error(`unexpected fetch: ${href}`)
    })

    const links = await findRecentSnfZipLinks(2, fetchImpl as unknown as typeof fetch, BASE_URL)
    expect(links.map((l) => l.fiscalYear)).toEqual([2025, 2024])
    expect(links[0].url).toBe('https://downloads.cms.gov/FILES/HCRIS/SNF10FY2025.ZIP')
    // Only the index page + the 2 targeted sub-pages should be fetched -- not the older years.
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('throws loudly if a targeted sub-page has no zip link, naming the exact page', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url)
      if (href === BASE_URL) return new Response(INDEX_HTML)
      return new Response('<html><body>no zip here</body></html>')
    })

    await expect(findRecentSnfZipLinks(1, fetchImpl as unknown as typeof fetch, BASE_URL)).rejects.toThrow(
      /No SNF cost report zip link found on sub-page/
    )
  })
})
