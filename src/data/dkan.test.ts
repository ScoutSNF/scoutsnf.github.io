import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCmsDatasetTable } from './dkan'

describe('fetchCmsDatasetTable JSON-pagination fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps paging when the API silently caps a page below the requested limit', async () => {
    // No CSV distribution, so this forces the JSON pagination fallback.
    const metastoreResponse = { distribution: [] }
    const page1 = { results: Array.from({ length: 100 }, (_, i) => ({ id: String(i) })) }
    const page2 = { results: Array.from({ length: 100 }, (_, i) => ({ id: String(100 + i) })) }
    const page3 = { results: [] }

    const fetchMock = vi.fn(async (requestUrl: string) => {
      // Requests to data.cms.gov are routed through a CORS proxy as `?url=<encoded target>`.
      const proxied = new URL(requestUrl)
      const target = new URL(proxied.searchParams.get('url') ?? requestUrl)

      if (target.pathname.includes('/metastore/')) {
        return new Response(JSON.stringify(metastoreResponse), { status: 200 })
      }
      if (target.searchParams.get('offset') === '0') {
        return new Response(JSON.stringify(page1), { status: 200 })
      }
      if (target.searchParams.get('offset') === '100') {
        return new Response(JSON.stringify(page2), { status: 200 })
      }
      return new Response(JSON.stringify(page3), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const table = await fetchCmsDatasetTable('some-id', 'Test dataset')

    // A server that caps every page at 100 rows (well below the 5000 requested)
    // must not cause early termination — all 200 real rows should be collected.
    expect(table.rows.length).toBe(200)
  })

  it('discards a truncated CSV distribution in favor of the full datastore query results', async () => {
    // The metastore lists a CSV distribution, but it's a stale/smaller file than
    // the live dataset — this is the "292 hospitals instead of ~5,400" bug.
    const metastoreResponse = {
      distribution: [{ downloadURL: 'https://data.cms.gov/dataset/some-id/download.csv', mediaType: 'text/csv' }]
    }
    const truncatedCsv = 'id\n1\n2\n3'
    const queryPage1 = { results: Array.from({ length: 100 }, (_, i) => ({ id: String(i) })) }
    const queryPage2 = { results: Array.from({ length: 40 }, (_, i) => ({ id: String(100 + i) })) }
    const queryPage3 = { results: [] }

    const fetchMock = vi.fn(async (requestUrl: string) => {
      const proxied = new URL(requestUrl)
      const target = new URL(proxied.searchParams.get('url') ?? requestUrl)

      if (target.pathname.includes('/metastore/')) {
        return new Response(JSON.stringify(metastoreResponse), { status: 200 })
      }
      if (target.pathname.endsWith('.csv')) {
        return new Response(truncatedCsv, { status: 200 })
      }
      if (target.searchParams.get('offset') === '0') {
        return new Response(JSON.stringify(queryPage1), { status: 200 })
      }
      if (target.searchParams.get('offset') === '100') {
        return new Response(JSON.stringify(queryPage2), { status: 200 })
      }
      return new Response(JSON.stringify(queryPage3), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const table = await fetchCmsDatasetTable('some-id', 'Test dataset')

    // Trusting the CSV's row count (3) would silently return a truncated dataset —
    // the query API's first page alone (100) already exceeds it, so the full,
    // correctly-paginated 140-row result must win instead.
    expect(table.rows.length).toBe(140)
  })
})
