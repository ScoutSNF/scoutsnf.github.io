import { useEffect, useMemo, useState } from 'react'
import type { PortfolioReportData } from '../lib/portfolioReport'
import type { FacilityRecord, HospitalType, SnfRecord, HospitalRecord, Portfolio } from '../types/facility'
import { StarRating } from './StarRating'
import { TypeBadge } from './TypeBadge'
import { getBedsDisplay, getOccupancyDisplay } from '../lib/facilityDisplay'
import { withinRadius } from '../lib/market'
import { HOSPITAL_TYPES } from '../lib/hospitalType'
import { PortfolioMap } from './PortfolioMap'
import { ResultsSection } from './ResultsSection'
import { RadiusSlider } from './RadiusSlider'

function memberId(m: PortfolioReportData['members'][number]): string {
  return `${m.facility.kind}:${m.facility.ccn}`
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

  useEffect(() => {
    if (data.members.length > 0 && (selectedId == null || !data.members.some((m) => memberId(m) === selectedId))) {
      setSelectedId(memberId(data.members[0]))
    }
  }, [data.members, selectedId])

  const selectedMember = data.members.find((m) => memberId(m) === selectedId) ?? null

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

  const [exporting, setExporting] = useState(false)

  async function exportReport() {
    setExporting(true)
    try {
      const { buildPortfolioWorkbook, downloadBlob } = await import('../lib/portfolioWorkbook')
      const blob = await buildPortfolioWorkbook(portfolio, data)
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
                  const id = memberId(m)
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
                  <p className="text-xs text-slate-400">
                    Gold-ringed pins are your portfolio's facilities — all of them stay visible regardless of which one is
                    selected. This is the exact same explore experience as a standalone facility: adjust the radius,
                    filter by type, browse the full list — the distance/shared-competition sections on the List tab are
                    the added portfolio context.
                  </p>

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
            <h2 className="mb-2 text-sm font-semibold">Facilities in this portfolio</h2>
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {data.members.map((m) => {
                const occ = getOccupancyDisplay(m.facility)
                return (
                  <div key={m.row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onOpen(m.facility, m.row.radiusMiles)}
                      title="Open full details, same as from ScoutBoard"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{m.row.name}</span>
                        <TypeBadge facility={m.facility} />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {m.row.city}, {m.row.state}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                      <span>{getBedsDisplay(m.facility)} beds</span>
                      <span>{occ.text} occ</span>
                      <StarRating rating={m.facility.overallRating} />
                      <button
                        onClick={() => onRemoveMember(memberId(m))}
                        className="text-slate-400 hover:text-red-500"
                        title="Remove from portfolio (returns it to ScoutBoard)"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {data.members.length >= 2 && (
            <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-2 text-sm font-semibold">Distance between your facilities</h2>
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {data.distances.map((d, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      {d.a.row.name} ↔ {d.b.row.name}
                    </span>
                    <span className="font-medium">{d.distanceMiles} mi</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">Competitors between your facilities</h2>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              SNFs within the saved search radius of two or more of your facilities — the shared competitive ground between
              them. {data.uniqueCompetitorCount} unique competitor{data.uniqueCompetitorCount === 1 ? '' : 's'} total across
              the portfolio.
            </p>
            {data.sharedCompetitors.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No competitors currently fall within range of more than one of your facilities.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {data.sharedCompetitors.map((c) => (
                  <div key={c.facility.ccn} className="py-2 text-sm">
                    <div className="font-medium">
                      {c.facility.name}{' '}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {c.facility.city}, {c.facility.state}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {c.near.map((n, i) => (
                        <span key={i}>
                          {n.distanceMiles} mi from {n.member.row.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold">Hospitals shared by 2+ of your facilities</h2>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Hospitals within the saved search radius of two or more of your facilities.{' '}
              {data.uniqueHospitalCount} unique hospital{data.uniqueHospitalCount === 1 ? '' : 's'} total across the
              portfolio.
            </p>
            {data.sharedHospitals.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No hospitals currently fall within range of more than one of your facilities.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {data.sharedHospitals.map((h) => (
                  <div key={h.facility.ccn} className="py-2 text-sm">
                    <div className="font-medium">
                      {h.facility.name}{' '}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {h.facility.city}, {h.facility.state}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {h.near.map((n, i) => (
                        <span key={i}>
                          {n.distanceMiles} mi from {n.member.row.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          </>
          )}
        </>
      )}
    </div>
  )
}
