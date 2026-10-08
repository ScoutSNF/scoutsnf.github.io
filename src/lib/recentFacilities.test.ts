import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readRecents, recordRecent, clearRecents, RECENTS_KEY, MAX_RECENTS } from './recentFacilities'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k)
  })
})

const fac = (ccn: string, name = `Facility ${ccn}`) => ({
  kind: 'snf' as const,
  ccn,
  name,
  city: 'Springfield',
  state: 'IL'
})

describe('recentFacilities', () => {
  it('records most-recent-first', () => {
    recordRecent(fac('1'))
    const list = recordRecent(fac('2'))
    expect(list.map((r) => r.ccn)).toEqual(['2', '1'])
  })

  it('de-duplicates a facility opened twice, moving it to the front', () => {
    recordRecent(fac('1'))
    recordRecent(fac('2'))
    const list = recordRecent(fac('1'))
    expect(list.map((r) => r.ccn)).toEqual(['1', '2'])
    expect(list).toHaveLength(2)
  })

  it('caps the list', () => {
    for (let i = 0; i < MAX_RECENTS + 4; i++) recordRecent(fac(String(i)))
    expect(readRecents()).toHaveLength(MAX_RECENTS)
  })

  // Recents are a convenience. Corrupt or hostile stored JSON must never stop Search rendering.
  it('survives corrupt stored data', () => {
    store.set(RECENTS_KEY, '{not json')
    expect(readRecents()).toEqual([])
    store.set(RECENTS_KEY, '{"not":"an array"}')
    expect(readRecents()).toEqual([])
    store.set(RECENTS_KEY, '[{"garbage":true},null,3]')
    expect(readRecents()).toEqual([])
  })

  it('survives localStorage throwing, as it does in private mode', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      }
    })
    expect(readRecents()).toEqual([])
    expect(() => recordRecent(fac('1'))).not.toThrow()
  })

  // Only public CMS fields belong here -- no notes, no portfolio membership, no identity.
  it('stores only public facility fields', () => {
    recordRecent(fac('1'))
    const stored = JSON.parse(store.get(RECENTS_KEY)!)
    expect(Object.keys(stored[0]).sort()).toEqual(['ccn', 'city', 'id', 'kind', 'name', 'openedAt', 'state'])
  })

  it('clears', () => {
    recordRecent(fac('1'))
    expect(clearRecents()).toEqual([])
    expect(readRecents()).toEqual([])
  })
})
