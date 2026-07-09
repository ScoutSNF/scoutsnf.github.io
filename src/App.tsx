import { useEffect, useMemo, useState } from 'react'
import type { FacilityRecord, HospitalType, SnfRecord, HospitalRecord } from './types/facility'
import { loadSnfData, loadHospitalData } from './data/dataset'
import { loadOccupancyForStates } from './data/occupancy'
import {
  listSavedFacilities,
  saveFacility,
  removeSavedFacility,
  updateSavedNotes,
  reorderSavedFacilities
} from './data/savedFacilities'
import type { SavedFacilityRow } from './data/db'
import { withinRadius, marketSnapshotLine, statesInResults } from './lib/market'
import { SearchBar } from './components/SearchBar'
import { AnchorCard } from './components/AnchorCard'
import { RadiusSlider } from './components/RadiusSlider'
import { ResultsSection } from './components/ResultsSection'
import { MapView } from './components/MapView'
import { DealBoard } from './components/DealBoard'
import { ExportBar } from './components/ExportBar'

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

  const [anchor, setAnchor] = useState<FacilityRecord | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(10)
  const [tab, setTab] = useState<'list' | 'map'>('list')
  const [hospitalTypeFilter, setHospitalTypeFilter] = useState<Set<HospitalType>>(new Set(HOSPITAL_TYPES))
  const [occupancyByPk, setOccupancyByPk] = useState<Map<string, { occupancyPct: number | null; asOfWeek: string | null }>>(
    new Map()
  )

  async function refreshSaved() {
    setSaved(await listSavedFacilities())
  }

  async function loadAll(forceRefresh = false) {
    setLoading(true)
    setErrors([])
    setLoadStage('Loading SNF roster…')
    const snfResult = await loadSnfData(forceRefresh)
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

  useEffect(() => {
    void loadAll(false)
    void refreshSaved()
  }, [])

  useEffect(() => {
    if (initialViewSet || loading) return
    setView(saved.length > 0 ? 'board' : 'search')
    setInitialViewSet(true)
  }, [loading, saved, initialViewSet])

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

  const snapshot = useMemo(() => marketSnapshotLine(snfResults, radiusMiles), [snfResults, radiusMiles])
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
            <span className="text-lg font-bold">ScoutSNF</span>
            <nav className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-sm dark:bg-slate-800">
              <button
                onClick={() => setView('board')}
                className={`rounded-md px-2 py-1 ${view === 'board' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
              >
                Deal Board {saved.length > 0 && `(${saved.length})`}
              </button>
              <button
                onClick={() => setView('search')}
                className={`rounded-md px-2 py-1 ${view === 'search' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
              >
                Search
              </button>
            </nav>
          </div>
          <button
            onClick={() => void loadAll(true)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Refresh data
          </button>
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
        <DealBoard
          saved={saved}
          snfs={snfs}
          hospitals={hospitals}
          snfFetchedAt={snfFetchedAt}
          hospitalFetchedAt={hospitalFetchedAt}
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
        />
      ) : (
        <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
          <SearchBar snfs={snfs} hospitals={hospitals} onSelect={setAnchor} />

          {anchor && (
            <>
              <AnchorCard
                facility={anchor}
                snapshotLine={snapshot}
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
                  <div className="h-[500px]">
                    <MapView anchor={anchor} radiusMiles={radiusMiles} results={[...snfResults, ...hospitalResults]} onSelect={setAnchor} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Anchor location unavailable — map view needs coordinates.</p>
                )
              ) : (
                <>
                  <ResultsSection
                    title="Skilled Nursing Facilities"
                    items={snfResults}
                    savedIds={savedIds}
                    onToggleSave={toggleSave}
                  />

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
        </main>
      )}
    </div>
  )
}
