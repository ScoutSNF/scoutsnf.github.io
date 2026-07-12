import { useEffect, useMemo, useState } from 'react'
import type { FacilityRecord, HospitalType, SnfRecord, HospitalRecord, Portfolio } from './types/facility'
import { loadSnfData, loadHospitalData, recheckSnfCoordinates } from './data/dataset'
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
import { AnchorCard } from './components/AnchorCard'
import { CostReportCard } from './components/CostReportCard'
import { RadiusSlider } from './components/RadiusSlider'
import { ResultsSection } from './components/ResultsSection'
import { MapView } from './components/MapView'
import { DealBoard } from './components/DealBoard'
import { PortfolioReport } from './components/PortfolioReport'
import { ExportBar } from './components/ExportBar'
import { SettingsMenu } from './components/SettingsMenu'
import { LegendPage } from './components/LegendPage'
import { CompareCard } from './components/CompareCard'
import { BottomNav } from './components/BottomNav'

type View = 'board' | 'search'

export default function App() {
  const [snfs, setSnfs] = useState<SnfRecord[]>([])
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([])
  const [snfFetchedAt, setSnfFetchedAt] = useState('')
  const [hospitalFetchedAt, setHospitalFetchedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadStage, setLoadStage] = useState('Loading SNF roster…')
  const [slowLoad, setSlowLoad] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const [saved, setSaved] = useState<SavedFacilityRow[]>([])
  const [view, setView] = useState<View>('search')
  const [initialViewSet, setInitialViewSet] = useState(false)

  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [memberIdsByPortfolio, setMemberIdsByPortfolio] = useState<Map<string, Set<string>>>(new Map())
  const [viewingPortfolioId, setViewingPortfolioId] = useState<string | null>(null)

  const [anchor, setAnchor] = useState<FacilityRecord | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(10)
  const [tab, setTab] = useState<'list' | 'map'>('list')
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
    setLoading(true)
    setErrors([])
    setLoadStage('Loading SNF roster…')
    const snfResult = await loadSnfData(forceRefresh, (stage, done, total) => {
      setLoadStage(
        stage === 'collisions'
          ? `Verifying SNF coordinates… ${done}/${total}`
          : stage === 'roster-retry'
            ? `Loading SNF roster… connection is slow, retrying (${done}/${total})`
            : 'Loading SNF roster…'
      )
    })
    setSnfs(snfResult.records)
    setSnfFetchedAt(snfResult.fetchedAt)
    if (snfResult.error) setErrors((e) => [...e, snfResult.error!])

    setLoadStage('Loading hospital roster + geocoding…')
    const hospitalResult = await loadHospitalData(forceRefresh, (stage, done, total) => {
      setLoadStage(
        stage === 'geocoding'
          ? `Geocoding hospitals… ${done}/${total}`
          : stage === 'roster-retry'
            ? `Loading hospital roster… connection is slow, retrying (${done}/${total})`
            : 'Fetching hospital bed counts…'
      )
    })
    setHospitals(hospitalResult.records)
    setHospitalFetchedAt(hospitalResult.fetchedAt)
    if (hospitalResult.error) setErrors((e) => [...e, hospitalResult.error!])

    setLoading(false)
  }

  async function recheckCoordinates(onProgress?: (done: number, total: number) => void) {
    const { records, checkedCount } = await recheckSnfCoordinates(onProgress)
    setSnfs(records)
    return checkedCount
  }

  useEffect(() => {
    void loadAll(false)
    void refreshSaved()
    void refreshPortfolios()
    // Supplementary, not required for the app to function -- doesn't gate the main loading screen,
    // and quietly stays empty if the pipeline hasn't produced the file yet.
    void loadCostReports().then(setCostReportsByCcn)
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
    if (initialViewSet || loading) return
    setView(saved.length > 0 ? 'board' : 'search')
    setInitialViewSet(true)
  }, [loading, saved, initialViewSet])

  useEffect(() => {
    setCompareFacility(null)
  }, [anchor])

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

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved])

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
    setAnchor(facility)
    setRadiusMiles(savedRadius)
    setView('search')
  }

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

  const portfolioReportData = useMemo(() => {
    if (!viewingPortfolio) return null
    const memberIds = [...(memberIdsByPortfolio.get(viewingPortfolio.id) ?? [])]
    const members = resolvePortfolioMembers(memberIds, saved, snfs, hospitals)
    return buildPortfolioReport(members, snfs, hospitals)
  }, [viewingPortfolio, memberIdsByPortfolio, saved, snfs, hospitals])

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{loadStage}</p>
        {slowLoad && (
          <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">
            Taking longer than usual — this can happen on a slow or unstable connection. Still working, no need to
            restart the app.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}brand/icon.svg`} alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-bold">ScoutSNF</span>
          </div>
          <SettingsMenu
            snfFetchedAt={snfFetchedAt}
            hospitalFetchedAt={hospitalFetchedAt}
            onRefresh={() => void loadAll(true)}
            onRecheckCoordinates={recheckCoordinates}
            onOpenLegend={() => setLegendOpen(true)}
          />
        </div>
        {errors.length > 0 && (
          <div className="mx-auto max-w-3xl px-4 pb-2">
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
      ) : view === 'board' ? (
        viewingPortfolio && portfolioReportData ? (
          <PortfolioReport
            portfolio={viewingPortfolio}
            data={portfolioReportData}
            snfs={snfs}
            hospitals={hospitals}
            savedIds={savedIds}
            onToggleSave={toggleSave}
            onOpen={openFromBoard}
            onClose={() => setViewingPortfolioId(null)}
            onRemoveMember={(facilityId) => handleToggleMember(viewingPortfolio.id, facilityId, false)}
          />
        ) : (
          <DealBoard
            saved={saved}
            snfs={snfs}
            hospitals={hospitals}
            snfFetchedAt={snfFetchedAt}
            hospitalFetchedAt={hospitalFetchedAt}
            portfolios={portfolios}
            memberIdsByPortfolio={memberIdsByPortfolio}
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
            onCreatePortfolio={handleCreatePortfolio}
            onDeletePortfolio={handleDeletePortfolio}
            onToggleMember={handleToggleMember}
            onViewReport={setViewingPortfolioId}
          />
        )
      ) : (
        <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
          <SearchBar snfs={snfs} hospitals={hospitals} onSelect={setAnchor} />

          {anchor && (
            <>
              <AnchorCard
                facility={anchor}
                saved={savedIds.has(`${anchor.kind}:${anchor.ccn}`)}
                onToggleSave={() => toggleSave(anchor)}
                actions={<ExportBar items={[...snfResults, ...hospitalResults]} anchorName={anchor.name} />}
                costReportRecords={costReportsByCcn.get(anchor.ccn)}
              />

              <CostReportCard records={costReportsByCcn.get(anchor.ccn) ?? []} kind={anchor.kind} />

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
                                  ? 'border-brand bg-brand/10 text-brand'
                                  : 'border-slate-300 text-slate-400 dark:border-slate-700'
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
                        onSelect={(facility, distanceMiles) => setCompareFacility({ facility, distanceMiles })}
                      />
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
                                  ? 'border-brand bg-brand/10 text-brand'
                                  : 'border-slate-300 text-slate-400 dark:border-slate-700'
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
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>
      )}
      <BottomNav
        view={view}
        onChangeView={(v) => {
          if (v === 'board') setViewingPortfolioId(null)
          setView(v)
        }}
        savedCount={saved.length}
      />
    </div>
  )
}
