import { describe, expect, it } from 'vitest'
import { parseRoute, routeToHash, facilityShareUrl, DEFAULT_ROUTE } from './routing'

describe('parseRoute', () => {
  it('treats an empty hash as the default view', () => {
    expect(parseRoute('')).toEqual(DEFAULT_ROUTE)
    expect(parseRoute('#')).toEqual(DEFAULT_ROUTE)
    expect(parseRoute('#/')).toEqual(DEFAULT_ROUTE)
  })

  it('parses a facility link', () => {
    expect(parseRoute('#/facility/snf/335565')).toEqual({
      view: 'search',
      facilityId: 'snf:335565',
      portfolioId: null
    })
  })

  it('parses a hospital facility link', () => {
    expect(parseRoute('#/facility/hospital/330101').facilityId).toBe('hospital:330101')
  })

  it('parses the named views', () => {
    expect(parseRoute('#/unfiled').view).toBe('unfiled')
    expect(parseRoute('#/legend').view).toBe('legend')
    expect(parseRoute('#/settings').view).toBe('settings')
  })

  // The ScoutBoard overview page was removed; portfolios are reached from the navigation and the
  // facilities in none of them have their own view. An old bookmark must still land somewhere.
  it('falls back to search for the retired board route', () => {
    expect(parseRoute('#/board').view).toBe('search')
  })

  it('parses a portfolio link', () => {
    expect(parseRoute('#/portfolio/p-123')).toEqual({
      view: 'portfolio',
      facilityId: null,
      portfolioId: 'p-123'
    })
  })

  // A hash is attacker-supplied: anyone can paste anything after the #. Unknown views fall back
  // rather than rendering nothing, and a malformed facility id resolves to null rather than being
  // handed on to a lookup.
  it('falls back to the default view for an unknown route', () => {
    expect(parseRoute('#/not-a-view').view).toBe('search')
  })

  it('rejects a malformed facility id instead of passing it through', () => {
    expect(parseRoute('#/facility/snf/<script>').facilityId).toBeNull()
    expect(parseRoute('#/facility/clinic/335565').facilityId).toBeNull()
    expect(parseRoute('#/facility/snf/').facilityId).toBeNull()
  })

  it('round-trips every route shape', () => {
    const routes = [
      { view: 'search' as const, facilityId: null, portfolioId: null },
      { view: 'search' as const, facilityId: 'snf:335565', portfolioId: null },
      { view: 'unfiled' as const, facilityId: null, portfolioId: null },
      { view: 'legend' as const, facilityId: null, portfolioId: null },
      { view: 'portfolio' as const, facilityId: null, portfolioId: 'p1' }
    ]
    for (const r of routes) {
      expect(parseRoute(routeToHash(r))).toEqual(r)
    }
  })
})

describe('facilityShareUrl', () => {
  // The single most important property of a shared link: it identifies a public CMS facility and
  // carries nothing about the person who sent it.
  it('contains only the public facility identifier', () => {
    const url = facilityShareUrl('snf:335565', 'https://scoutsnf.github.io/')
    expect(url).toContain('#/facility/snf/335565')
    for (const leak of ['email', 'device', 'name=', 'identity', 'notes', 'portfolio', '@']) {
      expect(url).not.toContain(leak)
    }
  })

  it('is absolute so it survives being pasted elsewhere', () => {
    expect(facilityShareUrl('snf:335565', 'https://scoutsnf.github.io/').startsWith('http')).toBe(true)
  })

  it('keeps whatever base path the app is served under', () => {
    expect(facilityShareUrl('snf:335565', 'https://example.com/scoutsnf/')).toBe(
      'https://example.com/scoutsnf/#/facility/snf/335565'
    )
  })

  // A link built while the sender was deep in their own session must not inherit that session.
  it('does not inherit an existing query string or hash from the sender', () => {
    const url = facilityShareUrl('snf:335565', 'https://scoutsnf.github.io/')
    expect(url.match(/#/g)).toHaveLength(1)
    expect(url).not.toContain('?')
  })
})
