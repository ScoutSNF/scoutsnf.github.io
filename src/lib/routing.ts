/**
 * URL state, as a hash route.
 *
 * The app had no routing at all: every view lived in React state, so Back/Forward did nothing and
 * there was no way to link to a facility. A hash route is used rather than History API paths
 * because this ships to GitHub Pages, which serves static files and cannot rewrite unknown paths
 * to index.html — `/facility/snf/335565` would 404 on a cold load, `#/facility/snf/335565` cannot.
 *
 * What a link may carry is deliberately narrow: a view name and a facility's kind + CCN, both of
 * which are public CMS identifiers. Name, email, device id, notes, portfolios and saved state are
 * local to a browser and never serialised into a URL.
 */

export type AppView = 'search' | 'board' | 'portfolio' | 'legend' | 'settings'

export interface AppRoute {
  view: AppView
  /** `${kind}:${ccn}` of the facility in focus, when the view has one. */
  facilityId: string | null
  /** Portfolio being viewed, for the portfolio view. Local id -- see note below. */
  portfolioId: string | null
}

export const DEFAULT_ROUTE: AppRoute = { view: 'search', facilityId: null, portfolioId: null }

const VIEWS: AppView[] = ['search', 'board', 'portfolio', 'legend', 'settings']

/** CCNs are 6 alphanumeric characters in CMS data; anything else is not a facility id we issued. */
const FACILITY_ID = /^(snf|hospital):([A-Za-z0-9]{1,10})$/

export function parseRoute(hash: string): AppRoute {
  const raw = hash.replace(/^#\/?/, '')
  if (!raw) return DEFAULT_ROUTE

  const [path, queryString] = raw.split('?')
  const segments = path.split('/').filter(Boolean)
  const query = new URLSearchParams(queryString ?? '')

  const head = segments[0] as AppView | undefined
  const view: AppView = head && VIEWS.includes(head) ? head : 'search'

  let facilityId: string | null = null
  if (segments[0] === 'facility' && segments[1] && segments[2]) {
    const candidate = `${segments[1]}:${segments[2]}`
    if (FACILITY_ID.test(candidate)) facilityId = candidate
  }

  // A facility link is a Search-view link; `#/facility/...` is the shareable shape.
  if (segments[0] === 'facility') {
    return { view: 'search', facilityId, portfolioId: null }
  }

  const portfolioId = view === 'portfolio' ? (segments[1] ?? query.get('id')) || null : null
  return { view, facilityId: null, portfolioId }
}

export function routeToHash(route: AppRoute): string {
  if (route.facilityId) {
    const [kind, ccn] = route.facilityId.split(':')
    return `#/facility/${kind}/${ccn}`
  }
  if (route.view === 'portfolio' && route.portfolioId) {
    return `#/portfolio/${route.portfolioId}`
  }
  if (route.view === 'search') return '#/'
  return `#/${route.view}`
}

/**
 * Absolute, shareable link to a facility.
 *
 * Built from `origin + pathname` so it keeps whatever base path GitHub Pages serves the app under,
 * and drops any existing query/hash so a link never inherits state from the sender's current
 * session. `base` is injectable so this is testable without a DOM.
 */
export function facilityShareUrl(facilityId: string, base?: string): string {
  const [kind, ccn] = facilityId.split(':')
  const root =
    base ??
    (typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`)
  return `${root}#/facility/${kind}/${ccn}`
}
