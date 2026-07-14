import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchHospitalBedCounts } from './pos'
import { CMS_POS_HOSPITAL_DATASET_UUID } from './sources'

describe('fetchHospitalBedCounts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches beds directly from the hardcoded dataset UUID, paging until an empty page', async () => {
    const page1 = [
      { PRVDR_NUM: '111111', CRTFD_BED_CNT: '140' },
      { PRVDR_NUM: '222222', CRTFD_BED_CNT: '220' }
    ]
    const page2: unknown[] = []

    const fetchMock = vi.fn(async (requestUrl: string) => {
      const proxied = new URL(requestUrl)
      const target = new URL(proxied.searchParams.get('url') ?? requestUrl)

      expect(target.pathname).toBe(`/data-api/v1/dataset/${CMS_POS_HOSPITAL_DATASET_UUID}/data`)

      if (target.searchParams.get('offset') === '0') {
        return new Response(JSON.stringify(page1), { status: 200 })
      }
      return new Response(JSON.stringify(page2), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const beds = await fetchHospitalBedCounts()

    expect(beds.get('111111')).toBe(140)
    expect(beds.get('222222')).toBe(220)
    expect(beds.size).toBe(2)
  })
})
