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
})
