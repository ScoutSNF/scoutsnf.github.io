import { useEffect, useMemo, useState } from 'react'
import type { PortfolioReportData } from '../lib/portfolioReport'
import { portfolioMemberId, buildPortfolioClusters, type Cluster } from '../lib/portfolioClusters'
import type { FacilityRecord, HospitalType, SnfRecord, HospitalRecord, Portfolio } from '../types/facility'
import { withinRadius } from '../lib/market'
import { HOSPITAL_TYPES } from '../lib/hospitalType'
import { PortfolioMap } from './PortfolioMap'
import { ResultsSection } from './ResultsSection'
import { RadiusSlider } from './RadiusSlider'
import { ClusterCard } from './ClusterCard'
import { ClusterSettingsRow, CLUSTER_THRESHOLD_OPTIONS } from './ClusterSettingsRow'
import { StandaloneRow } from './StandaloneRow'
import { PortfolioAnchorDrillDown } from './PortfolioAnchorDrillDown'
import { PortfolioMemberRow } from './PortfolioMemberRow'

const CLUSTER_THRESHOLD_KEY = 'scoutsnf:portfolioClusterThreshold'
const COMPETITOR_RADIUS_KEY = 'scoutsnf:portfolioCompetitorRadius'

function readStoredNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key)
  const n = raw != null ? Number(raw) : NaN
  return Number.isFinite(n) ? n : fallback
}

export function PortfolioReport({
  portfolio,
  data,
  snfs,
  hospitals,
  savedIds,
  onToggleSave,
  onOpen,
  onClose,
  onRemoveMember
}: {
  portfolio: Portfolio
  data: PortfolioReportData
  snfs: SnfRecord[]
  hospitals: HospitalRecord[]
  savedIds: Set<string>
  onToggleSave: (facility: FacilityRecord, radiusOverride?: number) => void
  onOpen: (facility: FacilityRecord, radiusMiles: number) => void
  onClose: () => void
  onRemoveMember: (facilityId: string) => void
}) {
  const [tab, setTab] = useState<'list' | 'map'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [radiusOverride, setRadiusOverride] = useState<number | null>(null)
  const [resultFilter, setResultFilter] = useState<'all' | 'snf' | 'hospital'>('all')
  const [hospitalTypeFilter, setHospitalTypeFilter] = useState<Set<HospitalType>>(new Set(HOSPITAL_TYPES))

  const [clusterThreshold, setClusterThreshold] = useState(() => readStoredNumber(CLUSTER_THRESHOLD_KEY, 25))
  const [competitorRadius, setCompetitorRadius] = useState(() => readStoredNumber(COMPETITOR_RADIUS_KEY, 15))
  const [drilldownId, setDrilldownId] = useState<string | null>(null)
  const [membersExpanded, setMembersExpanded] = useState(false)

  function changeClusterThreshold(v: number) {
    setClusterThreshold(v)
    localStorage.setItem(CLUSTER_THRESHOLD_KEY, String(v))
  }
  function changeCompetitorRadius(v: number) {
    setCompetitorRadius(v)
    localStorage.setItem(COMPETITOR_RADIUS_KEY, String(v))
  }

  useEffect(() => {
    if (data.members.length > 0 && (selectedId == null || !data.members.some((m) => portfolioMemberId(m) === selectedId))) {
      setSelectedId(portfolioMemberId(data.members[0]))
    }
  }, [data.members, selectedId])

  useEffect(() => {
    setDrilldownId(null)
  }, [portfolio.id])

  const selectedMember = data.members.find((m) => portfolioMemberId(m) === selectedId) ?? null

  // Live radius exploration, same idea as the regular search page's slider — starts at the
  // facility's saved radius but doesn't overwrite it unless the user explicitly saves again.
  useEffect(() => {
    setRadiusOverride(null)
  }, [selectedId])
  const effectiveRadius = radiusOverride ?? selectedMember?.row.radiusMiles ?? 10

  const memberSnfCcns = useMemo(
    () => new Set(data.members.filter((m) => m.facility.kind === 'snf').map((m) => m.facility.ccn)),
    [data.members]
  )
  const memberHospitalCcns = useMemo(
    () => new Set(data.members.filter((m) => m.facility.kind === 'hospital').map((m) => m.facility.ccn)),
    [data.members]
  )

  const liveCompetitors = useMemo(() => {
    if (!selectedMember?.facility.latitude || !selectedMember?.facility.longitude) return []
    return withinRadius(
      { latitude: selectedMember.facility.latitude, longitude: selectedMember.facility.longitude },
      snfs,
      effectiveRadius,
      selectedMember.facility.kind === 'snf' ? selectedMember.facility.ccn : undefined
    ).filter((r) => !memberSnfCcns.has(r.facility.ccn))
  }, [selectedMember, snfs, effectiveRadius, memberSnfCcns])

  const liveHospitalsAll = useMemo(() => {
    if (!selectedMember?.facility.latitude || !selectedMember?.facility.longitude) return []
    return withinRadius(
      { latitude: selectedMember.facility.latitude, longitude: selectedMember.facility.longitude },
      hospitals,
      effectiveRadius,
      selectedMember.facility.kind === 'hospital' ? selectedMember.facility.ccn : undefined
    ).filter((r) => !memberHospitalCcns.has(r.facility.ccn))
  }, [selectedMember, hospitals, effectiveRadius, memberHospitalCcns])

  const liveHospitals = useMemo(
    () => liveHospitalsAll.filter((r) => hospitalTypeFilter.has(r.facility.hospitalType)),
    [liveHospitalsAll, hospitalTypeFilter]
  )

  const mapCompetitors = resultFilter === 'hospital' ? [] : liveCompetitors
  const mapHospitals = resultFilter === 'snf' ? [] : liveHospitals

  const combinedResults =
    resultFilter === 'snf' ? liveCompetitors : resultFilter === 'hospital' ? liveHospitals : [...liveCompetitors, ...liveHospitals]

  const clusterResult = useMemo(
    () => buildPortfolioClusters(data.members, data.distances, snfs, hospitals, clusterThreshold, competitorRadius),
    [data.members, data.distances, snfs, hospitals, clusterThreshold, competitorRadius]
  )

  const clusterByMemberId = useMemo(() => {
    const map = new Map<string, Cluster>()
    for (const c of clusterResult.clusters) {
      for (const m of c.members) map.set(portfolioMemberId(m), c)
    }
    return map
  }, [clusterResult])

  const drilldownMember = drilldownId != null ? data.members.find((m) => portfolioMemberId(m) === drilldownId) ?? null : null
  const soleMember = data.members.length === 1 ? data.members[0] : null
  const nextLargerThreshold = CLUSTER_THRESHOLD_OPTIONS.find((t) => t > clusterThreshold) ?? null

  const [exporting, setExporting] = useState(false)

  async function exportReport() {
    setExporting(true)
    try {
      const { buildPortfolioWorkbook, downloadBlob } = await import('../lib/portfolioWorkbook')
      const blob = await buildPortfolioWorkbook(portfolio, data, clusterResult, clusterThreshold, competitorRadius)
      downloadBlob(`${portfolio.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-report.xlsx`, blob)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <div>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            ← Back to ScoutBoard
          </button>
          <h1 className="mt-1 text-xl font-bold">{portfolio.name}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {data.members.length} facilit{data.members.length === 1 ? 'y' : 'ies'}
            {data.statesCovered.length > 0 ? ` · ${data.statesCovered.join(', ')}` : ''}
          </p>
        </div>
        <button
          onClick={exportReport}
          disabled={exporting}
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-60"
        >
          {exporting ? 'Building…' : 'Download report (Excel)'}
        </button>
      </div>

      {data.members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No facilities in this portfolio yet. Add some from ScoutBoard.
        </p>
      ) : (
        <>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-sm dark:bg-slate-800">
            <button onClick={() => setTab('list')} className={`rounded-md px-3 py-1 ${tab === 'list' ? 'bg-white shadow dark:bg-slate-700' : ''}`}>
              List
            </button>
            <button onClick={() => setTab('map')} className={`rounded-md px-3 py-1 ${tab === 'map' ? 'bg-white shadow dark:bg-slate-700' : ''}`}>
              Map
            </button>
          </div>

          {tab === 'map' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {data.members.map((m) => {
                  const id = portfolioMemberId(m)
                  const active = id === selectedId
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedId(id)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        active ? 'border-brand bg-brand/10 text-brand' : 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {m.row.name}
                    </button>
                  )
                })}
              </div>

              {selectedMember && (
                <>
                  <RadiusSlider
                    value={effectiveRadius}
                    onChange={setRadiusOverride}
                    facilityCount={liveCompetitors.length + liveHospitals.length}
                  />

                  <div className="h-[420px]">
                    <PortfolioMap
                      members={data.members}
                      selectedId={selectedId}
                      radiusMiles={effectiveRadius}
                      competitors={mapCompetitors}
                      hospitals={mapHospitals}
                      onSelect={setSelectedId}
                    />
                  </div>

                  <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-sm dark:bg-slate-800">
                    <button
                      onClick={() => setResultFilter('all')}
                      className={`flex-1 rounded-md px-3 py-1.5 ${resultFilter === 'all' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
                    >
                      Both ({liveCompetitors.length + liveHospitals.length})
                    </button>
                    <button
                      onClick={() => setResultFilter('snf')}
                      className={`flex-1 rounded-md px-3 py-1.5 ${resultFilter === 'snf' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
                    >
                      SNFs ({liveCompetitors.length})
                    </button>
                    <button
                      onClick={() => setResultFilter('hospital')}
                      className={`flex-1 rounded-md px-3 py-1.5 ${resultFilter === 'hospital' ? 'bg-white shadow dark:bg-slate-700' : ''}`}
                    >
                      Hospitals ({liveHospitals.length})
                    </button>
                  </div>

                  {resultFilter !== 'snf' && (
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

                  <ResultsSection
                    title={`Within ${effectiveRadius} mi of ${selectedMember.row.name}`}
                    items={combinedResults}
                    savedIds={savedIds}
                    onToggleSave={(facility) => onToggleSave(facility, effectiveRadius)}
                  />
                </>
              )}
            </>
          )}

          {tab === 'list' && (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <button
                  onClick={() => setMembersExpanded((v) => !v)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <h2 className="text-sm font-semibold">Facilities in this portfolio ({data.members.length})</h2>
                  <span className="text-xs text-sky-600 dark:text-sky-400">{membersExpanded ? 'Hide' : 'Show all'}</span>
                </button>
                {membersExpanded && (
                <div className="mt-2 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                  {data.members.map((m) => (
                    <PortfolioMemberRow
                      key={m.row.id}
                      member={m}
                      onClick={() => onOpen(m.facility, m.row.radiusMiles)}
                      trailing={
                        <button
                          onClick={() => onRemoveMember(portfolioMemberId(m))}
                          className="text-slate-400 hover:text-red-500"
                          title="Remove from portfolio (returns it to ScoutBoard)"
                        >
                          ✕
                        </button>
                      }
                    />
                  ))}
                </div>
                )}
              </section>

              {soleMember ? (
                <PortfolioAnchorDrillDown
                  anchor={soleMember}
                  members={data.members}
                  distances={data.distances}
                  clusterByMemberId={clusterByMemberId}
                  snfs={snfs}
                  hospitals={hospitals}
                  competitorRadiusMiles={competitorRadius}
                  savedIds={savedIds}
                  onToggleSave={onToggleSave}
                  onSelectFacility={() => {}}
                  onBack={() => {}}
                  showBack={false}
                />
              ) : drilldownMember ? (
                <PortfolioAnchorDrillDown
                  anchor={drilldownMember}
                  members={data.members}
                  distances={data.distances}
                  clusterByMemberId={clusterByMemberId}
                  snfs={snfs}
                  hospitals={hospitals}
                  competitorRadiusMiles={competitorRadius}
                  savedIds={savedIds}
                  onToggleSave={onToggleSave}
                  onSelectFacility={(m) => setDrilldownId(portfolioMemberId(m))}
                  onBack={() => setDrilldownId(null)}
                />
              ) : (
                <>
                  <ClusterSettingsRow
                    clusterThreshold={clusterThreshold}
                    onClusterThresholdChange={changeClusterThreshold}
                    competitorRadius={competitorRadius}
                    onCompetitorRadiusChange={changeCompetitorRadius}
                  />

                  {clusterResult.clusters.length === 0 && nextLargerThreshold != null && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No clusters at {clusterThreshold} mi —{' '}
                      <button onClick={() => changeClusterThreshold(nextLargerThreshold)} className="text-sky-600 hover:underline dark:text-sky-400">
                        try {nextLargerThreshold} mi
                      </button>
                      .
                    </p>
                  )}

                  {clusterResult.clusters.map((cluster) => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      onSelectFacility={(m) => setDrilldownId(portfolioMemberId(m))}
                    />
                  ))}

                  {clusterResult.standalones.length > 0 && (
                    <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <h2 className="mb-2 text-sm font-semibold">Standalone facilities</h2>
                      <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                        {clusterResult.standalones.map((s) => (
                          <StandaloneRow
                            key={s.member.row.id}
                            standalone={s}
                            onClick={() => setDrilldownId(portfolioMemberId(s.member))}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
