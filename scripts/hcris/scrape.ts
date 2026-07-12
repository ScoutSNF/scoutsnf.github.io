export const COST_REPORTS_BY_FY_URL =
  'https://www.cms.gov/data-research/statistics-trends-and-reports/cost-reports/cost-reports-fiscal-year'

export interface FyZipLink {
  fiscalYear: number
  url: string
  linkText: string
}

/**
 * Extracts every <a href> from raw HTML without a full DOM/HTML parser dependency -- this page is
 * a plain list of download links, not markup complex enough to need one.
 */
function extractLinks(html: string): { href: string; text: string }[] {
  const links: { href: string; text: string }[] = []
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    links.push({ href: m[1], text })
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

/**
 * Finds SNF-2010 (form CMS-2540-10) cost report zip links on the Cost Reports by Fiscal Year page,
 * one per fiscal year. Fails loudly (throws) rather than falling back to a guessed URL pattern if
 * nothing matching is found -- the calling pipeline should hard-fail its run in that case, not
 * silently skip a year.
 */
export async function findSnfZipLinks(html: string, baseUrl = COST_REPORTS_BY_FY_URL): Promise<FyZipLink[]> {
  const links = extractLinks(html)
  const results: FyZipLink[] = []

  for (const { href, text } of links) {
    if (!/\.zip($|\?)/i.test(href)) continue
    const haystack = `${href} ${text}`
    if (!/\bSNF\b/i.test(haystack)) continue
    const yearMatch = haystack.match(/20\d{2}/)
    if (!yearMatch) continue
    results.push({ fiscalYear: Number(yearMatch[0]), url: resolveUrl(href, baseUrl), linkText: text })
  }

  if (results.length === 0) {
    throw new Error(
      `No SNF cost report zip links found on ${baseUrl} -- the page structure may have changed. ` +
        `Refusing to guess a URL pattern; update scrape.ts's extraction logic against the real page.`
    )
  }

  // One link per year -- if a year appears more than once, prefer the last (later in page order,
  // typically the more current listing).
  const byYear = new Map<number, FyZipLink>()
  for (const r of results) byYear.set(r.fiscalYear, r)
  return [...byYear.values()].sort((a, b) => b.fiscalYear - a.fiscalYear)
}

/** Picks the N most recent fiscal years from a full link list. */
export function mostRecentFiscalYears(links: FyZipLink[], count: number): FyZipLink[] {
  return [...links].sort((a, b) => b.fiscalYear - a.fiscalYear).slice(0, count)
}
