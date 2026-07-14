import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchHospitalBedCounts } from './pos'

describe('fetchHospitalBedCounts diagnostics', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('includes near-miss titles in the error when no dataset title matches', async () => {
    const metastoreItems: unknown[] = []
    const dataJsonCatalog = {
      dataset: [
        { title: 'Hospital General Information', identifier: 'unrelated-1' },
        { title: 'Home Health Agency Provider of Services File', identifier: 'unrelated-2' }
      ]
    }

    const fetchMock = vi.fn(async (requestUrl: string) => {
      const proxied = new URL(requestUrl)
      const target = new URL(proxied.searchParams.get('url') ?? requestUrl)

      if (target.pathname.includes('/metastore/')) {
        return new Response(JSON.stringify(metastoreItems), { status: 200 })
      }
      if (target.pathname === '/data.json') {
        return new Response(JSON.stringify(dataJsonCatalog), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchHospitalBedCounts()).rejects.toThrow(
      /no match among 2 datasets; closest titles:.*Home Health Agency Provider of Services File/
    )
  })
})
