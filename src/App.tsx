import { useEffect, useMemo, useState } from 'react'
import type { FacilityRecord, HospitalType, SnfRecord, HospitalRecord, Portfolio } from './types/facility'
import { loadSnfData, loadHospitalData, recheckSnfCoordinates } from './data/dataset'
import { loadOccupancyForStates } from './data/occupancy'
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
import { withinRadius, statesInResults } from './lib/market'
import { resolvePortfolioMembers, buildPortfolioReport } from './lib/portfolioReport'
import { SearchBar } from './components/SearchBar'
import { AnchorCard } from './components/AnchorCard'
import { RadiusSlider } from './components/RadiusSlider'
import { ResultsSection } from './components/ResultsSection'
import { MapView } from './components/MapView'
import { DealBoard } from './components/DealBoard'
import { PortfolioReport } from './components/PortfolioReport'
import { ExportBar } from './components/ExportBar'
import { SettingsMenu } from './components/SettingsMenu'
import { CompareCard } from './components/CompareCard'
import { BottomNav } from './components/BottomNav'

const HOSPITAL_TYPES: HospitalType[] = [
  'Acute Care',
  'Critical Access',
  'Psychiatric',
  "Children's",
  'VA',
  'DoD',
  'LTCH',
  'Inpatient Rehab',
  'Other'
]

type View = 'board' | 'search'

export default function App() {
  const [snfs, setSnfs] = useState<SnfRecord[]>([])
  const [hospitals, setHospitals] = useState<HospitalRecord[]>([])
  const [snfFetchedAt, setSnfFetchedAt] = useState('')
  const [hospitalFetchedAt, setHospitalFetchedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadStage, setLoadStage] = useState('Loading SNF roster…')
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
  const [occupancyByPk, setOccupancyByPk] = useState<Map<string, { occupancyPct: number | null; asOfWeek: string | null }>>(
    new Map()
  )

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
      setLoadStage(stage === 'collisions' ? `Verifying SNF coordinates… ${done}/${total}` : 'Loading SNF roster…')
    })
    setSnfs(snfResult.records)
    setSnfFetchedAt(snfResult.fetchedAt)
    if (snfResult.error) setErrors((e) => [...e, snfResult.error!])

    setLoadStage('Loading hospital roster + geocoding…')
    const hospitalResult = await loadHospitalData(forceRefresh, (stage, done, total) => {
      setLoadStage(stage === 'geocoding' ? `Geocoding hospitals… ${done}/${total}` : 'Fetching hospital bed counts…')
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
  }, [])

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
    () => hospitalResultsAll.map((r) => ({
      ...r,
      facility: {
        ...r.facility,
        occupancyPct: occupancyByPk.get(r.facility.ccn)?.occupancyPct ?? r.facility.occupancyPct,
        occupancyAsOfWeek: occupancyByPk.get(r.facility.ccn)?.asOfWeek ?? r.facility.occupancyAsOfWeek
      }
    })).filter((r) => hospitalTypeFilter.has(r.facility.hospitalType)),
    [hospitalResultsAll, hospitalTypeFilter, occupancyByPk]
  )

  useEffect(() => {
    if (hospitalResultsAll.length === 0) return
    const states = statesInResults([], hospitalResultsAll)
    void loadOccupancyForStates(states).then((map) => {
      const obj = new Map<string, { occupancyPct: number | null; asOfWeek: string | null }>()
      for (const [k, v] of map) obj.set(k, v)
      setOccupancyByPk(obj)
    })
  }, [hospitalResultsAll])

  const mapResults = useMemo(() => {
    if (mapFilter === 'snf') return snfResults
    if (mapFilter === 'hospital') return hospitalResults
    return [...snfResults, ...hospitalResults]
  }, [mapFilter, snfResults, hospitalResults])

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved])

  async function toggleSave(facility: FacilityRecord) {
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
        radiusMiles
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
    return buildPortfolioReport(members, snfs)
  }, [viewingPortfolio, memberIdsByPortfolio, saved, snfs, hospitals])

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{loadStage}</p>
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

      {view === 'board' ? (
        viewingPortfolio && portfolioReportData ? (
          <PortfolioReport
            portfolio={viewingPortfolio}
            data={portfolioReportData}
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
            onGoToSearch={() => setView('search')}
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
              />

              <RadiusSlider
                value={radiusMiles}
                onChange={setRadiusMiles}
                facilityCount={snfResults.length + hospitalResults.length}
              />

              <div className="flex items-center justify-between">
                <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-sm dark:bg-slate-800">
                  <button onClick={() => setTab('list')} className={`rounded-md px-3 py-1 ${tab === 'list' ? 'bg-white shadow dark:bg-slate-700' : ''}`}>
                    List
                  </button>
                  <button onClick={() => setTab('map')} className={`rounded-md px-3 py-1 ${tab === 'map' ? 'bg-white shadow dark:bg-slate-700' : ''}`}>
                    Map
                  </button>
                </div>
                <ExportBar items={[...snfResults, ...hospitalResults]} anchorName={anchor.name} />
              </div>

              <p className="text-xs text-slate-400">
                Distance is straight-line (haversine), not drive time.
              </p>

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
                      title="Skilled Nursing Facilities"
                      items={snfResults}
                      savedIds={savedIds}
                      onToggleSave={toggleSave}
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
                        title="Hospitals"
                        items={hospitalResults}
                        savedIds={savedIds}
                        onToggleSave={toggleSave}
                      />
                      <p className="text-[11px] text-slate-400">
                        Facility-level hospital occupancy is no longer publicly reported; values shown are the last federally reported week.
                      </p>
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
