export const COST_REPORTS_BY_FY_URL =
  'https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year'

export interface FyPageLink {
  fiscalYear: number
  url: string
}

export interface FyZipLink {
  fiscalYear: number
  url: string
  linkText: string
}

/**
 * Extracts every <a href> from raw HTML without a full DOM/HTML parser dependency -- these pages
 * are plain lists of links, not markup complex enough to need one. CMS's page editor sometimes
 * emits single-quoted (and stray-space) href attributes, e.g. href=' https://...', so both quote
 * styles are handled and the captured href is trimmed.
 */
function extractLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = []
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    links.push({ href: m[1].trim(), text })
  }
  return links
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}

// Matches the SNF-2010 (form CMS-2540-10) per-fiscal-year sub-page path, e.g.
// ".../cost-reports-fiscal-year/snf-2010-fy-2025-data-files" or the older
// ".../cost-reports-fiscal-year/snf10-2010-fy-2022" naming. Deliberately anchored on the literal
// "2010" form marker so it does not match other SNF-adjacent pages (e.g. a future "snf-2024-fy-*"
// form revision) or other provider types (hospital-2010-*, hha20-*, etc).
const SUBPAGE_RE = /\/cost-reports-fiscal-year\/snf-?(?:10-)?2010-fy-?(\d{4})/i

/**
 * Finds the per-fiscal-year SNF-2010 sub-page links on the "Cost Reports by Fiscal Year" index
 * page. The index page itself never links directly to a zip file -- it links to one sub-page per
 * form per fiscal year, and the actual download link lives on that sub-page. Fails loudly (throws)
 * rather than falling back to a guessed URL pattern if nothing matching is found.
 */
export function findSnfFormYearPages(html: string, baseUrl = COST_REPORTS_BY_FY_URL): FyPageLink[] {
  const links = extractLinks(html)
  const results: FyPageLink[] = []

  for (const { href } of links) {
    const match = href.match(SUBPAGE_RE)
    if (!match) continue
    results.push({ fiscalYear: Number(match[1]), url: resolveUrl(href, baseUrl) })
  }

  if (results.length === 0) {
    throw new Error(
      `No SNF-2010 fiscal-year sub-pages found on ${baseUrl} -- the page structure may have changed. ` +
        `Refusing to guess a URL pattern; update scrape.ts's extraction logic against the real page.`
    )
  }

  // One page per year -- if a year appears more than once, prefer the last (later in page order,
  // typically the more current listing).
  const byYear = new Map<number, FyPageLink>()
  for (const r of results) byYear.set(r.fiscalYear, r)
  return [...byYear.values()].sort((a, b) => b.fiscalYear - a.fiscalYear)
}

/**
 * Finds the SNF cost report zip download link on a single fiscal-year sub-page (as returned by
 * `findSnfFormYearPages`). Real filenames look like "SNF10FY2025.ZIP" -- note there is no word
 * boundary between "SNF" and the digits that follow, so matching must not require one on the
 * right-hand side.
 */
export function findSnfZipLinkOnPage(html: string, baseUrl: string): { url: string; linkText: string } | null {
  const links = extractLinks(html)
  for (const { href, text } of links) {
    if (!/\.zip($|\?)/i.test(href)) continue
    const haystack = `${href} ${text}`
    if (!/\bSNF/i.test(haystack)) continue
    return { url: resolveUrl(href, baseUrl), linkText: text }
  }
  return null
}

/** Picks the N most recent fiscal years from a list of year-tagged links or pages. */
export function mostRecentFiscalYears<T extends { fiscalYear: number }>(items: T[], count: number): T[] {
  return [...items].sort((a, b) => b.fiscalYear - a.fiscalYear).slice(0, count)
}

/**
 * Full two-level scrape: fetches the index page, finds the N most recent SNF-2010 fiscal-year
 * sub-pages, then fetches each sub-page and extracts its zip download link. Fails loudly if a
 * targeted sub-page turns out not to have a zip link, rather than silently skipping that year.
 */
export async function findRecentSnfZipLinks(
  fyWindow: number,
  fetchImpl: typeof fetch = fetch,
  baseUrl = COST_REPORTS_BY_FY_URL
): Promise<FyZipLink[]> {
  const indexHtml = await (await fetchImpl(baseUrl)).text()
  const allPages = findSnfFormYearPages(indexHtml, baseUrl)
  const targetPages = mostRecentFiscalYears(allPages, fyWindow)

  const results: FyZipLink[] = []
  for (const page of targetPages) {
    const subHtml = await (await fetchImpl(page.url)).text()
    const zip = findSnfZipLinkOnPage(subHtml, page.url)
    if (!zip) {
      throw new Error(`No SNF cost report zip link found on sub-page ${page.url} (FY${page.fiscalYear})`)
    }
    results.push({ fiscalYear: page.fiscalYear, url: zip.url, linkText: zip.linkText })
  }
  return results.sort((a, b) => b.fiscalYear - a.fiscalYear)
}
