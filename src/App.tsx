import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FacilityRecord, HospitalType, SnfRecord, HospitalRecord, Portfolio } from './types/facility'
import {
  loadSnfData,
  loadHospitalData,
  loadRosterManifest,
  recheckSnfCoordinates,
  getCachedSnf,
  getCachedHospitals,
  type RosterManifest
} from './data/dataset'
import { loadCostReports } from './data/costReports'
import type { FacilityYearRecord } from './types/costReport'
import { HOSPITAL_TYPES } from './lib/hospitalType'
import {
  listSavedFacilities,
  saveFacility,
  removeSavedFacility,
  updateSavedNotes,
  reorderSavedFacilities
} from './data/savedFacilities'
import {
  listPortfolios,
  createPortfolio,
  deletePortfolio,
  setFacilityInPortfolio,
  listAllPortfolioMembers
} from './data/portfolios'
import type { SavedFacilityRow } from './data/db'
import { withinRadius } from './lib/market'
import { resolvePortfolioMembers, buildPortfolioReport } from './lib/portfolioReport'
import { SearchBar } from './components/SearchBar'
import { AnchorCard, OwnershipSection } from './components/AnchorCard'
import { DetailTabs } from './components/DetailTabs'
import { CompareTray } from './components/CompareTray'
import { CommandMenu, MOD_KEY } from './components/CommandMenu'
import { MAX_COMPARE } from './components/CompareTable'
import { CostReportCard } from './components/CostReportCard'
import { RadiusSlider } from './components/RadiusSlider'
import { ResultsSection } from './components/ResultsSection'
import { MapView } from './components/MapView'
import { UnfiledPage } from './components/UnfiledPage'
import { PortfolioReport } from './components/PortfolioReport'
import { ExportBar } from './components/ExportBar'
import { LegendPage } from './components/LegendPage'
import { CompareCard } from './components/CompareCard'
import { SideNav, MobileNav } from './components/AppNav'
import { SettingsPage } from './components/SettingsPage'
import { useHashRoute } from './hooks/useHashRoute'
import type { AppView } from './lib/routing'
import { SearchEmptyState } from './components/SearchEmptyState'
import { MarketMediansCard } from './components/MarketMediansCard'
import { computeMarketMedians, describeStandouts } from './lib/marketMedians'
import { readRecents, recordRecent, clearRecents, type RecentFacility } from './lib/recentFacilities'

export default function App() {
  const [snfs, setSnfs] = useState<SnfRecord[]>([])
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([])
  const [snfFetchedAt, setSnfFetchedAt] = useState('')
  const [hospitalFetchedAt, setHospitalFetchedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadStage, setLoadStage] = useState('Loading SNF roster…')
  const [slowLoad, setSlowLoad] = useState(false)
  /** True while a refresh runs quietly behind already-visible cached data (e.g. the
   * automatic re-fetch once cached data turns a week old) rather than blocking the app
   * behind the full-screen loading spinner. */
  const [refreshing, setRefreshing] = useState(false)
  const [refreshStage, setRefreshStage] = useState('')
  const [rosterManifest, setRosterManifest] = useState<RosterManifest | null>(null)

  const [errors, setErrors] = useState<string[]>([])

  const [saved, setSaved] = useState<SavedFacilityRow[]>([])

  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [memberIdsByPortfolio, setMemberIdsByPortfolio] = useState<Map<string, Set<string>>>(new Map())


  /**
   * The URL hash is the source of truth for which view and which facility are open, so Back and
   * Forward work and a facility can be linked to. `anchor` below is derived from it rather than
   * held independently -- two sources of truth for "what am I looking at" is how the Legend page
   * previously got stranded behind a nav that had quietly changed the view underneath it.
   */
  const [route, navigate] = useHashRoute()
  const view = route.view
  const legendOpen = route.view === 'legend'
  const viewingPortfolioId = route.view === 'portfolio' ? route.portfolioId : null

  const goToView = useCallback(
    (v: AppView) => navigate({ view: v, facilityId: null, portfolioId: null }),
    [navigate]
  )
  const setLegendOpen = useCallback(
    (open: boolean) => navigate({ view: open ? 'legend' : 'search', facilityId: null, portfolioId: null }),
    [navigate]
  )
  const setViewingPortfolioId = useCallback(
    (id: string | null) =>
      navigate({ view: id ? 'portfolio' : 'unfiled', facilityId: null, portfolioId: id }),
    [navigate]
  )
  const openFacility = useCallback(
    (facility: FacilityRecord, replace = false) =>
      navigate(
        { view: 'search', facilityId: `${facility.kind}:${facility.ccn}`, portfolioId: null },
        replace
      ),
    [navigate]
  )

  /**
   * Whether the sidebar's portfolio list is showing. ScoutBoard is a disclosure rather than a
   * destination, so this is plain UI state and deliberately not in the URL -- a shared link should
   * not carry whether the sender happened to have the list open, and `view` already says which
   * portfolio is being looked at.
   *
   * Always starts collapsed, including for someone with saved facilities. Nothing opens it but a
   * tap on ScoutBoard.
   */
  const [boardOpen, setBoardOpen] = useState(false)

  const [recents, setRecents] = useState<RecentFacility[]>(() => readRecents())

  const [anchor, setAnchor] = useState<FacilityRecord | null>(null)
  /** Where to return when the back link is used: 'plain' = ScoutBoard's top-level list, a portfolio
   * id = that specific portfolio's report, null = anchor wasn't opened from ScoutBoard (no back link). */
  const [returnTarget, setReturnTarget] = useState<'plain' | string | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(10)
  const [tab, setTab] = useState<'list' | 'map'>('list')
  const [detailTab, setDetailTab] = useState('overview')
  const [commandOpen, setCommandOpen] = useState(false)

  /**
   * Facilities picked for side-by-side comparison. Held in App rather than inside the tray so a
   * selection survives navigating between markets, which is the only way picking four facilities
   * from different searches can work.
   */
  const [compareSet, setCompareSet] = useState<FacilityRecord[]>([])

  const toggleCompare = useCallback((facility: FacilityRecord) => {
    setCompareSet((prev) => {
      const id = `${facility.kind}:${facility.ccn}`
      const existing = prev.findIndex((f) => `${f.kind}:${f.ccn}` === id)
      if (existing >= 0) return prev.filter((_, i) => i !== existing)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, facility]
    })
  }, [])
  const [facilityTab, setFacilityTab] = useState<'snf' | 'hospital'>('snf')
  const [mapFilter, setMapFilter] = useState<'all' | 'snf' | 'hospital'>('all')
  const [compareFacility, setCompareFacility] = useState<{ facility: FacilityRecord; distanceMiles: number } | null>(null)
  const [hospitalTypeFilter, setHospitalTypeFilter] = useState<Set<HospitalType>>(new Set(HOSPITAL_TYPES))
  const [costReportsByCcn, setCostReportsByCcn] = useState<Map<string, FacilityYearRecord[]>>(new Map())

  async function refreshSaved() {
    setSaved(await listSavedFacilities())
  }

  async function refreshPortfolios() {
    setPortfolios(await listPortfolios())
    const members = await listAllPortfolioMembers()
    const map = new Map<string, Set<string>>()
    for (const m of members) {
      const set = map.get(m.portfolioId) ?? new Set<string>()
      set.add(m.facilityId)
      map.set(m.portfolioId, set)
    }
    setMemberIdsByPortfolio(map)
  }

  async function loadAll(forceRefresh = false) {
    // If we already have cached data and this isn't an explicit "Refresh data…" click, don't
    // block the app behind the full-screen spinner for what's usually just a handful of new
    // facilities (e.g. the automatic re-fetch once cached data turns a week old) -- show what's
    // on hand immediately and let the refresh run quietly underneath it.
    const [cachedSnf, cachedHospital] = await Promise.all([getCachedSnf(), getCachedHospitals()])
    const hasCache = cachedSnf.records.length > 0 && cachedHospital.records.length > 0
    const background = hasCache && !forceRefresh

    if (background) {
      setSnfs(cachedSnf.records)
      setHospitals(cachedHospital.records)
      setSnfFetchedAt(cachedSnf.fetchedAt)
      setHospitalFetchedAt(cachedHospital.fetchedAt)
      setLoading(false)
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setErrors([])
    setLoadStage('Loading SNF roster…')
    const snfResult = await loadSnfData(forceRefresh, (attempt, attempts) => {
      const text = `Loading SNF roster… connection is slow, retrying (${attempt}/${attempts})`
      setLoadStage(text)
      setRefreshStage(text)
    })
    setSnfs(snfResult.records)
    setSnfFetchedAt(snfResult.fetchedAt)
    if (snfResult.error) setErrors((e) => [...e, snfResult.error!])

    setLoadStage('Loading hospital roster…')
    const hospitalResult = await loadHospitalData(forceRefresh, (attempt, attempts) => {
      const text = `Loading hospital roster… connection is slow, retrying (${attempt}/${attempts})`
      setLoadStage(text)
      setRefreshStage(text)
    })
    setHospitals(hospitalResult.records)
    setHospitalFetchedAt(hospitalResult.fetchedAt)
    if (hospitalResult.error) setErrors((e) => [...e, hospitalResult.error!])

    setLoading(false)
    setRefreshing(false)
    setRefreshStage('')
  }

  async function recheckCoordinates() {
    const { collisionCount, checkedAgainstLatest } = await recheckSnfCoordinates()
    if (checkedAgainstLatest) {
      const { records } = await getCachedSnf()
      setSnfs(records)
    }
    return { collisionCount, checkedAgainstLatest }
  }

  useEffect(() => {
    void loadAll(false)
    void refreshSaved()
    void refreshPortfolios()
    // Supplementary, not required for the app to function -- doesn't gate the main loading screen,
    // and quietly stays empty if the pipeline hasn't produced the file yet.
    void loadCostReports().then(setCostReportsByCcn)
    void loadRosterManifest().then(setRosterManifest)
  }, [])

  useEffect(() => {
    if (!loading) {
      setSlowLoad(false)
      return
    }
    // Timed off `loading` alone (not `loadStage`) — retries update loadStage every
    // 0.5-2s and would otherwise keep resetting this before it ever fires.
    const timer = setTimeout(() => setSlowLoad(true), 10_000)
    return () => clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    setCompareFacility(null)
  }, [anchor])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /**
   * Resolve the routed facility against the loaded roster.
   *
   * Runs again when the roster arrives, so a link opened cold (hash parsed before any data exists)
   * still lands on its facility rather than silently showing an empty Search. An id that matches
   * nothing -- a retired CCN, a typo in a pasted link -- clears the anchor rather than leaving the
   * previous facility on screen pretending to be the requested one.
   */
  useEffect(() => {
    if (!route.facilityId) {
      setAnchor(null)
      return
    }
    const [kind, ccn] = route.facilityId.split(':')
    const found: FacilityRecord | undefined =
      kind === 'snf' ? snfs.find((f) => f.ccn === ccn) : hospitals.find((f) => f.ccn === ccn)
    if (found) {
      setAnchor(found)
      setRecents(recordRecent(found))
    } else if (snfs.length > 0 && hospitals.length > 0) {
      setAnchor(null)
    }
  }, [route.facilityId, snfs, hospitals])

  const snfResults = useMemo(() => {
    if (!anchor || anchor.latitude == null || anchor.longitude == null) return []
    return withinRadius(
      { latitude: anchor.latitude, longitude: anchor.longitude },
      snfs,
      radiusMiles,
      anchor.kind === 'snf' ? anchor.ccn : undefined
    )
  }, [anchor, snfs, radiusMiles])

  const hospitalResultsAll = useMemo(() => {
    if (!anchor || anchor.latitude == null || anchor.longitude == null) return []
    return withinRadius(
      { latitude: anchor.latitude, longitude: anchor.longitude },
      hospitals,
      radiusMiles,
      anchor.kind === 'hospital' ? anchor.ccn : undefined
    )
  }, [anchor, hospitals, radiusMiles])

  const hospitalResults = useMemo(
    () => hospitalResultsAll.filter((r) => hospitalTypeFilter.has(r.facility.hospitalType)),
    [hospitalResultsAll, hospitalTypeFilter]
  )

  const mapResults = useMemo(() => {
    if (mapFilter === 'snf') return snfResults
    if (mapFilter === 'hospital') return hospitalResults
    return [...snfResults, ...hospitalResults]
  }, [mapFilter, snfResults, hospitalResults])

  const marketMedians = useMemo(() => {
    if (!anchor) return null
    return computeMarketMedians(
      anchor,
      snfResults.map((r) => r.facility),
      costReportsByCcn
    )
  }, [anchor, snfResults, costReportsByCcn])

  const marketStandouts = useMemo(
    () => (anchor && marketMedians ? describeStandouts(marketMedians, anchor) : []),
    [anchor, marketMedians]
  )

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved])
  const compareIds = useMemo(() => new Set(compareSet.map((f) => `${f.kind}:${f.ccn}`)), [compareSet])

  /**
   * A concrete facility for the empty state's "Try an example" button, so a first-time visitor can
   * see a populated market without having to think of a facility name.
   *
   * Picks from the densest cluster of SNFs in the roster rather than the first row: the first row
   * is an Alabama facility with two neighbours inside 10 miles, which demonstrates an empty market
   * analysis. Bucketing by a coarse lat/lon grid is one pass over the roster and finds a genuinely
   * competitive market; cost-report history is preferred within that cell so the financial panels
   * are populated too.
   */
  const exampleFacility = useMemo(() => {
    const geocoded = snfs.filter((s) => s.latitude != null && s.longitude != null)
    if (geocoded.length === 0) return null

    const cells = new Map<string, SnfRecord[]>()
    for (const s of geocoded) {
      const key = `${Math.round(s.latitude! * 4)}:${Math.round(s.longitude! * 4)}`
      const bucket = cells.get(key)
      if (bucket) bucket.push(s)
      else cells.set(key, [s])
    }

    let densest: SnfRecord[] = []
    for (const bucket of cells.values()) {
      if (bucket.length > densest.length) densest = bucket
    }
    if (densest.length === 0) return geocoded[0]

    const withCostReport = densest.find((s) => (costReportsByCcn.get(s.ccn)?.length ?? 0) >= 2)
    return withCostReport ?? densest[0]
  }, [snfs, costReportsByCcn])

  async function toggleSave(facility: FacilityRecord, radiusOverride?: number) {
    const id = `${facility.kind}:${facility.ccn}`
    if (savedIds.has(id)) {
      await removeSavedFacility(facility.kind, facility.ccn)
    } else {
      await saveFacility({
        kind: facility.kind,
        ccn: facility.ccn,
        name: facility.name,
        city: facility.city,
        state: facility.state,
        radiusMiles: radiusOverride ?? radiusMiles
      })
    }
    await refreshSaved()
  }

  function openFromBoard(facility: FacilityRecord, savedRadius: number) {
    setReturnTarget(viewingPortfolioId ?? 'plain')
    setRadiusMiles(savedRadius)
    openFacility(facility)
  }

  // Stable identity so MapView's marker-drawing effect doesn't rerun (and its now-separate
  // recenter effect stays untouched by this) just because App re-rendered for an unrelated reason.
  const handleMapSelect = useCallback((facility: FacilityRecord, distanceMiles: number) => {
    setCompareFacility({ facility, distanceMiles })
  }, [])

  // From a list row's "View on map" -- highlights the facility (same treatment as comparing it)
  // and jumps to the Map tab, distinct from that row's separate "Open in Google Maps" link.
  const handleViewOnMap = useCallback((facility: FacilityRecord, distanceMiles: number) => {
    setCompareFacility({ facility, distanceMiles })
    setTab('map')
  }, [])

  async function handleCreatePortfolio(name: string) {
    await createPortfolio(name)
    await refreshPortfolios()
  }

  async function handleDeletePortfolio(id: string) {
    await deletePortfolio(id)
    if (viewingPortfolioId === id) setViewingPortfolioId(null)
    await refreshPortfolios()
  }

  async function handleToggleMember(portfolioId: string, facilityId: string, inPortfolio: boolean) {
    await setFacilityInPortfolio(portfolioId, facilityId, inPortfolio)
    await refreshPortfolios()
  }

  const viewingPortfolio = useMemo(
    () => portfolios.find((p) => p.id === viewingPortfolioId) ?? null,
    [portfolios, viewingPortfolioId]
  )

  /** Saved facilities in no portfolio: both the Unfiled view's contents and its nav row's count. */
  const unfiledSaved = useMemo(() => {
    const assigned = new Set<string>()
    for (const ids of memberIdsByPortfolio.values()) for (const id of ids) assigned.add(id)
    return saved.filter((row) => !assigned.has(row.id))
  }, [saved, memberIdsByPortfolio])

  const portfolioNavItems = useMemo(
    () =>
      portfolios.map((p) => ({ id: p.id, name: p.name, count: memberIdsByPortfolio.get(p.id)?.size ?? 0 })),
    [portfolios, memberIdsByPortfolio]
  )

  const portfolioReportData = useMemo(() => {
    if (!viewingPortfolio) return null
    const memberIds = [...(memberIdsByPortfolio.get(viewingPortfolio.id) ?? [])]
    const members = resolvePortfolioMembers(memberIds, saved, snfs, hospitals)
    return buildPortfolioReport(members)
  }, [viewingPortfolio, memberIdsByPortfolio, saved, snfs, hospitals])

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{loadStage}</p>
        {slowLoad && (
          <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
            Taking longer than usual — this can happen on a slow or unstable connection. Still working, no need to
            restart the app.
          </p>
        )}
      </div>
    )
  }

  const navigateFromNav = (v: AppView) => {
    setReturnTarget(null)
    goToView(v)
  }

  const navProps = {
    view,
    portfolioId: viewingPortfolioId,
    savedCount: saved.length,
    portfolios: portfolioNavItems,
    unfiledCount: unfiledSaved.length,
    boardOpen,
    onToggleBoard: () => setBoardOpen((v) => !v),
    onNavigate: navigateFromNav,
    onOpenPortfolio: (id: string) => {
      setReturnTarget(null)
      setViewingPortfolioId(id)
    },
    onNewPortfolio: (name: string) => void handleCreatePortfolio(name)
  }

  return (
    <div className="flex min-h-screen">
      <SideNav {...navProps} />

      <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-[--color-border] bg-[--color-surface]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 lg:max-w-[96rem]">
          <div className="flex items-center gap-2 lg:hidden">
            <img src={`${import.meta.env.BASE_URL}brand/icon.svg`} alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold">ScoutSNF</span>
          </div>
          <h1 className="hidden text-base font-semibold text-[--color-text] lg:block">
            {view === 'unfiled' ? 'Unfiled' : view === 'portfolio' ? (viewingPortfolio?.name ?? 'Portfolio') : view === 'legend' ? 'Sources & definitions' : view === 'settings' ? 'Settings' : 'Facility search'}
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden items-center gap-2 rounded-[--radius-md] border border-[--color-border-strong] px-2.5 py-1.5 text-sm text-[--color-text-secondary] hover:bg-[--color-surface-hover] sm:flex"
            >
              <span>Quick find</span>
              <kbd className="rounded-[--radius-sm] border border-[--color-border] px-1 font-sans text-xs">{MOD_KEY}</kbd>
              <kbd className="rounded-[--radius-sm] border border-[--color-border] px-1 font-sans text-xs">K</kbd>
            </button>
            {refreshing && (
              <span
                title={refreshStage || 'Updating data…'}
                className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
              >
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                Updating…
              </span>
            )}
          </div>
        </div>
        {errors.length > 0 && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-2 lg:max-w-[96rem]">
            {errors.map((e, i) => (
              <p key={i} className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {e}
              </p>
            ))}
          </div>
        )}
      </header>

      {legendOpen ? (
        <LegendPage onBack={() => setLegendOpen(false)} />
      ) : view === 'settings' ? (
        <SettingsPage
          snfFetchedAt={snfFetchedAt}
          hospitalFetchedAt={hospitalFetchedAt}
          rosterManifest={rosterManifest}
          refreshing={refreshing}
          onRefresh={() => void loadAll(true)}
          onRecheckCoordinates={recheckCoordinates}
          onOpenLegend={() => setLegendOpen(true)}
        />
      ) : view === 'unfiled' || view === 'portfolio' ? (
        viewingPortfolio && portfolioReportData ? (
          <PortfolioReport
            portfolio={viewingPortfolio}
            data={portfolioReportData}
            snfs={snfs}
            hospitals={hospitals}
            savedIds={savedIds}
            costReportsByCcn={costReportsByCcn}
            onToggleSave={toggleSave}
            onOpen={openFromBoard}
            onDelete={() => void handleDeletePortfolio(viewingPortfolio.id)}
            onRemoveMember={(facilityId) => handleToggleMember(viewingPortfolio.id, facilityId, false)}
          />
        ) : (
          <UnfiledPage
            unfiled={unfiledSaved}
            snfs={snfs}
            hospitals={hospitals}
            portfolios={portfolios}
            memberIdsByPortfolio={memberIdsByPortfolio}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
            onOpen={openFromBoard}
            onRemove={async (row) => {
              await removeSavedFacility(row.kind, row.ccn)
              await refreshSaved()
            }}
            onNotesChange={async (row, notes) => {
              await updateSavedNotes(row.kind, row.ccn, notes)
              await refreshSaved()
            }}
            onMove={async (row, dir) => {
              const ids = saved.map((s) => s.id)
              const i = ids.indexOf(row.id)
              const j = i + dir
              if (j < 0 || j >= ids.length) return
              ;[ids[i], ids[j]] = [ids[j], ids[i]]
              await reorderSavedFacilities(ids)
              await refreshSaved()
            }}
            onToggleMember={handleToggleMember}
          />
        )
      ) : (
        <main className={`mx-auto w-full max-w-3xl flex-col gap-4 p-4 ${compareSet.length > 0 ? 'pb-44 lg:pb-32' : 'pb-24 lg:pb-8'} lg:grid lg:max-w-[96rem] lg:grid-cols-[minmax(26rem,32rem)_minmax(0,1fr)] lg:items-start lg:gap-6 flex`}>
          {/* Left pane on desktop: search, the selected facility and its financials. The right
              pane takes the market list/map, which is what actually benefits from width. Below
              lg both panes stack into the original single column. */}
          <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pr-1">
            {returnTarget !== null && (
              <button
                onClick={() => {
                  const target = returnTarget
                  setReturnTarget(null)
                  setViewingPortfolioId(target === 'plain' ? null : target)
                }}
                className="self-start text-sm text-slate-600 hover:text-brand dark:text-slate-300"
              >
                ← Back to {returnTarget === 'plain' ? 'Unfiled' : (portfolios.find((p) => p.id === returnTarget)?.name ?? 'Unfiled')}
              </button>
            )}

            <SearchBar
              snfs={snfs}
              hospitals={hospitals}
              dataReady={snfs.length > 0 && hospitals.length > 0}
              loadError={errors[0] ?? null}
              onSelect={(facility) => {
                setReturnTarget(null)
                openFacility(facility)
              }}
            />

            {!anchor && (
              <SearchEmptyState
                recents={recents}
                onOpenRecent={(r) => {
                  setReturnTarget(null)
                  navigate({ view: 'search', facilityId: r.id, portfolioId: null })
                }}
                onClearRecents={() => setRecents(clearRecents())}
                onTryExample={
                  exampleFacility
                    ? () => {
                        setReturnTarget(null)
                        openFacility(exampleFacility)
                      }
                    : undefined
                }
              />
            )}

            {anchor && (
              <>
                {/* Labelled so a selected facility still on screen during a fruitless search reads
                    as "what I was looking at", not as a result for the query just typed. */}
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <span>Currently viewing</span>
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  <button
                    onClick={() => {
                      setReturnTarget(null)
                      navigate({ view: 'search', facilityId: null, portfolioId: null })
                    }}
                    className="font-medium normal-case tracking-normal text-slate-500 hover:text-brand dark:text-slate-400 dark:hover:text-sky-300"
                  >
                    Clear
                  </button>
                </div>

                <AnchorCard
                  facility={anchor}
                  saved={savedIds.has(`${anchor.kind}:${anchor.ccn}`)}
                  onToggleSave={() => toggleSave(anchor)}
                  actions={<ExportBar items={[...snfResults, ...hospitalResults]} anchorName={anchor.name} />}
                  costReportRecords={costReportsByCcn.get(anchor.ccn)}
                />

                {/* Panels stay mounted and hidden, so switching back to Financials keeps expanded
                    rows, chart tooltips and scroll position rather than rebuilding the section. */}
                <DetailTabs
                  active={detailTab}
                  onChange={setDetailTab}
                  tabs={[
                    {
                      id: 'overview',
                      label: 'Overview',
                      content: (
                        <div className="flex flex-col gap-3">
                          {marketMedians && (
                            <MarketMediansCard
                              medians={marketMedians}
                              standouts={marketStandouts}
                              anchor={anchor}
                              radiusMiles={radiusMiles}
                            />
                          )}
                        </div>
                      )
                    },
                    {
                      id: 'financials',
                      label: 'Financials',
                      hint: (costReportsByCcn.get(anchor.ccn)?.length ?? 0) === 0 ? 'none filed' : undefined,
                      content:
                        (costReportsByCcn.get(anchor.ccn)?.length ?? 0) === 0 ? (
                          <p className="text-sm text-[--color-text-secondary]">
                            No HCRIS cost report is on file for this facility in the published dataset. That is an
                            absence in the source data, not a zero.
                          </p>
                        ) : (
                          <CostReportCard records={costReportsByCcn.get(anchor.ccn) ?? []} kind={anchor.kind} />
                        )
                    },
                    {
                      id: 'ownership',
                      label: 'Ownership',
                      content: <OwnershipSection facility={anchor} />
                    }
                  ]}
                />
              </>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {anchor && (
              <>

              <RadiusSlider
                value={radiusMiles}
                onChange={setRadiusMiles}
                facilityCount={snfResults.length + hospitalResults.length}
              />



              <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-sm dark:bg-slate-800">
                <button onClick={() => setTab('list')} className={`rounded-md px-3 py-1 ${tab === 'list' ? 'bg-white shadow dark:bg-slate-700' : ''}`}>
                  List
                </button>
                <button onClick={() => setTab('map')} className={`rounded-md px-3 py-1 ${tab === 'map' ? 'bg-white shadow dark:bg-slate-700' : ''}`}>
                  Map
                </button>
              </div>

              {compareFacility && (
                <CompareCard
                  anchor={anchor}
                  facility={compareFacility.facility}
                  distanceMiles={compareFacility.distanceMiles}
                  savedIds={savedIds}
                  onToggleSave={toggleSave}
                  onClose={() => setCompareFacility(null)}
                  costReportsByCcn={costReportsByCcn}
                />
              )}

              {tab === 'map' ? (
                anchor.latitude != null && anchor.longitude != null ? (
                  <>
                    <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-sm dark:bg-slate-800">
                      <button
                        onClick={() => setMapFilter('all')}
                        className={`flex-1 rounded-md px-3 py-1.5 ${mapFilter === 'all' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
                      >
                        Both ({snfResults.length + hospitalResults.length})
                      </button>
                      <button
                        onClick={() => setMapFilter('snf')}
                        className={`flex-1 rounded-md px-3 py-1.5 ${mapFilter === 'snf' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
                      >
                        SNFs ({snfResults.length})
                      </button>
                      <button
                        onClick={() => setMapFilter('hospital')}
                        className={`flex-1 rounded-md px-3 py-1.5 ${mapFilter === 'hospital' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
                      >
                        Hospitals ({hospitalResults.length})
                      </button>
                    </div>

                    {mapFilter !== 'snf' && (
                      <div className="flex flex-wrap gap-1.5">
                        {HOSPITAL_TYPES.map((t) => {
                          const active = hospitalTypeFilter.has(t)
                          return (
                            <button
                              key={t}
                              onClick={() =>
                                setHospitalTypeFilter((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(t)) next.delete(t)
                                  else next.add(t)
                                  return next
                                })
                              }
                              className={`rounded-full border px-2.5 py-1 text-xs ${
                                active
                                  ? 'border-brand bg-brand/10 text-brand dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-300'
                                  : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {t}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <div className="h-[500px]">
                      <MapView
                        anchor={anchor}
                        radiusMiles={radiusMiles}
                        results={mapResults}
                        highlight={compareFacility?.facility}
                        onSelect={handleMapSelect}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Anchor location unavailable — map view needs coordinates.</p>
                )
              ) : (
                <>
                  <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-sm dark:bg-slate-800">
                    <button
                      onClick={() => setFacilityTab('snf')}
                      className={`flex-1 rounded-md px-3 py-1.5 ${facilityTab === 'snf' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
                    >
                      Skilled Nursing Facilities ({snfResults.length})
                    </button>
                    <button
                      onClick={() => setFacilityTab('hospital')}
                      className={`flex-1 rounded-md px-3 py-1.5 ${facilityTab === 'hospital' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
                    >
                      Hospitals ({hospitalResults.length})
                    </button>
                  </div>

                  {facilityTab === 'snf' ? (
                    <ResultsSection
                      items={snfResults}
                      savedIds={savedIds}
                      onToggleSave={toggleSave}
                      costReportsByCcn={costReportsByCcn}
                      onCompare={(facility, distanceMiles) => setCompareFacility({ facility, distanceMiles })}
                      onAddToCompare={toggleCompare}
                      compareIds={compareIds}
                      onViewOnMap={handleViewOnMap}
                      onSelect={handleMapSelect}
                      selectedId={compareFacility ? `${compareFacility.facility.kind}:${compareFacility.facility.ccn}` : null}
                    />
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {HOSPITAL_TYPES.map((t) => {
                          const active = hospitalTypeFilter.has(t)
                          return (
                            <button
                              key={t}
                              onClick={() =>
                                setHospitalTypeFilter((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(t)) next.delete(t)
                                  else next.add(t)
                                  return next
                                })
                              }
                              className={`rounded-full border px-2.5 py-1 text-xs ${
                                active
                                  ? 'border-brand bg-brand/10 text-brand dark:border-sky-400 dark:bg-sky-400/10 dark:text-sky-300'
                                  : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {t}
                            </button>
                          )
                        })}
                      </div>

                      <ResultsSection
                        items={hospitalResults}
                        savedIds={savedIds}
                        onToggleSave={toggleSave}
                        costReportsByCcn={costReportsByCcn}
                        onCompare={(facility, distanceMiles) => setCompareFacility({ facility, distanceMiles })}
                        onAddToCompare={toggleCompare}
                        compareIds={compareIds}
                        onViewOnMap={handleViewOnMap}
                        onSelect={handleMapSelect}
                        selectedId={compareFacility ? `${compareFacility.facility.kind}:${compareFacility.facility.ccn}` : null}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
          </div>
        </main>
      )}
      </div>

      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        snfs={snfs}
        hospitals={hospitals}
        onSelectFacility={(f) => {
          setReturnTarget(null)
          openFacility(f)
        }}
        onNavigate={navigateFromNav}
        extraActions={
          compareSet.length > 0
            ? [{ id: 'clear-compare', label: `Clear comparison (${compareSet.length})`, hint: 'Action', run: () => setCompareSet([]) }]
            : []
        }
      />

      <CompareTray
        selected={compareSet}
        costReportsByCcn={costReportsByCcn}
        onRemove={toggleCompare}
        onClear={() => setCompareSet([])}
      />

      <MobileNav {...navProps} />
    </div>
  )
}
