import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import type { SnfRecord, HospitalRecord } from '../types/facility'
import type { PortfolioMemberResolved } from '../lib/portfolioReport'
import { MAP_COLORS, dotIcon } from '../lib/mapIcons'
import { clusterByGrid, clusterIcon } from '../lib/mapCluster'
import { titleCaseName } from '../lib/facilityDisplay'

export function PortfolioMap({
  members,
  selectedId,
  radiusMiles,
  competitors,
  hospitals,
  onSelect,
  onCompare,
  highlight
}: {
  members: PortfolioMemberResolved[]
  selectedId: string | null
  radiusMiles: number
  competitors: { facility: SnfRecord; distanceMiles: number }[]
  hospitals: { facility: HospitalRecord; distanceMiles: number }[]
  onSelect: (id: string) => void
  onCompare?: (facility: SnfRecord | HospitalRecord, distanceMiles: number) => void
  /** The facility currently shown in the "compare to anchor" card, if any — gets a highlight ring + dashed line to the anchor. */
  highlight?: SnfRecord | HospitalRecord | null
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  /** Bumped on zoom so the marker effect re-clusters. Grid clustering is defined in screen space,
   *  so without this the groups computed at the initial zoom would stay frozen as you zoom in. */
  const [zoomTick, setZoomTick] = useState(0)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    const onZoom = () => setZoomTick((n) => n + 1)
    map.on('zoomend', onZoom)
    return () => {
      map.off('zoomend', onZoom)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const selectedMember = members.find((m) => `${m.facility.kind}:${m.facility.ccn}` === selectedId)
    const bounds: L.LatLngExpression[] = []

    // Radius circle for the selected facility only — but every portfolio facility still
    // gets a marker below, regardless of whether it falls inside this circle.
    if (selectedMember?.facility.latitude != null && selectedMember?.facility.longitude != null) {
      const radiusMeters = radiusMiles * 1609.34
      L.circle([selectedMember.facility.latitude, selectedMember.facility.longitude], {
        radius: radiusMeters,
        color: MAP_COLORS.anchor,
        fillOpacity: 0.05,
        weight: 1
      }).addTo(layer)
    }

    // Every portfolio facility renders teal (vs. blue SNF/red hospital competitors), but only the
    // selected one gets the gold-ring "highlighted" treatment — otherwise all portfolio pins look
    // identical at a wide zoom and the selected one is impossible to pick out.
    for (const m of members) {
      if (m.facility.latitude == null || m.facility.longitude == null) continue
      const id = `${m.facility.kind}:${m.facility.ccn}`
      const isSelected = id === selectedId
      bounds.push([m.facility.latitude, m.facility.longitude])
      const marker = L.marker([m.facility.latitude, m.facility.longitude], {
        icon: dotIcon(MAP_COLORS.anchor, 12, isSelected),
        zIndexOffset: isSelected ? 1000 : 500
      }).addTo(layer)
      marker.bindPopup(`<strong>${titleCaseName(m.row.name)}</strong><br/>Portfolio facility${isSelected ? ' (selected)' : ''}`)
      marker.on('click', () => onSelect(id))
    }

    function bindComparePopup(marker: L.Marker, facility: SnfRecord | HospitalRecord, distanceMiles: number, anchorName: string) {
      const popupDiv = document.createElement('div')
      popupDiv.innerHTML = `<strong>${titleCaseName(facility.name)}</strong><br/>${distanceMiles} mi from ${anchorName}<br/>`
      if (onCompare) {
        const btn = document.createElement('button')
        btn.textContent = 'Compare to anchor'
        btn.style.cssText = 'color:#0f4c5c;text-decoration:underline;font-size:12px;background:none;border:none;padding:0;cursor:pointer'
        btn.onclick = () => onCompare(facility, distanceMiles)
        popupDiv.appendChild(btn)
      }
      marker.bindPopup(popupDiv)
    }

    function isHighlighted(facility: SnfRecord | HospitalRecord): boolean {
      return highlight != null && highlight.kind === facility.kind && highlight.ccn === facility.ccn
    }

    if (selectedMember) {
      // Dashed line from the anchor to whichever facility is currently in the "compare to
      // anchor" card, same treatment the regular search map gives its compared pin.
      if (
        highlight != null &&
        highlight.latitude != null &&
        highlight.longitude != null &&
        selectedMember.facility.latitude != null &&
        selectedMember.facility.longitude != null
      ) {
        const line: L.LatLngExpression[] = [
          [selectedMember.facility.latitude, selectedMember.facility.longitude],
          [highlight.latitude, highlight.longitude]
        ]
        L.polyline(line, { color: '#1e293b', weight: 5, opacity: 0.55 }).addTo(layer)
        L.polyline(line, { color: MAP_COLORS.highlightRing, weight: 3, dashArray: '10 6', opacity: 1 }).addTo(layer)
      }

      // Competitors and hospitals are clustered; portfolio members above deliberately are not,
      // since they are the subject of this view and must stay individually visible. A highlighted
      // facility is also kept out of its cluster so "compare to anchor" never hides its own pin.
      type Nearby = { facility: SnfRecord | HospitalRecord; distanceMiles: number }
      const clusterable: Nearby[] = []

      for (const n of [...competitors, ...hospitals] as Nearby[]) {
        if (n.facility.latitude == null || n.facility.longitude == null) continue
        bounds.push([n.facility.latitude, n.facility.longitude])
        if (isHighlighted(n.facility)) {
          const marker = L.marker([n.facility.latitude, n.facility.longitude], {
            icon: dotIcon(MAP_COLORS[n.facility.kind], 12, true),
            zIndexOffset: 900
          }).addTo(layer)
          bindComparePopup(marker, n.facility, n.distanceMiles, selectedMember.row.name)
        } else {
          clusterable.push(n)
        }
      }

      for (const cluster of clusterByGrid(
        map,
        clusterable.map((n) => ({ lat: n.facility.latitude!, lon: n.facility.longitude!, item: n }))
      )) {
        if (cluster.points.length === 1) {
          const n = cluster.points[0].item
          const marker = L.marker([cluster.lat, cluster.lon], {
            icon: dotIcon(MAP_COLORS[n.facility.kind], 12, false)
          }).addTo(layer)
          bindComparePopup(marker, n.facility, n.distanceMiles, selectedMember.row.name)
          continue
        }

        const snfCount = cluster.points.filter((p) => p.item.facility.kind === 'snf').length
        const hospitalCount = cluster.points.length - snfCount
        // Coloured by whichever kind dominates the cluster, so the SNF/hospital read survives
        // clustering instead of every group going a neutral grey.
        const color = snfCount >= hospitalCount ? MAP_COLORS.snf : MAP_COLORS.hospital
        const marker = L.marker([cluster.lat, cluster.lon], {
          icon: clusterIcon(cluster.points.length, color)
        }).addTo(layer)
        marker.bindPopup(
          `<strong>${cluster.points.length} facilities</strong><br/>${snfCount} SNF${snfCount === 1 ? '' : 's'}, ${hospitalCount} hospital${hospitalCount === 1 ? '' : 's'}<br/><em>Zoom in to separate</em>`
        )
        marker.on('click', () => {
          map.setView([cluster.lat, cluster.lon], Math.min(map.getZoom() + 2, 18))
        })
      }
    }

  }, [members, selectedId, radiusMiles, competitors, hospitals, onSelect, onCompare, highlight, zoomTick])

  // Fitting the view is split into its own effect, deliberately narrower than the marker-drawing
  // one above: it should only run when the selected facility, the portfolio's membership, or the
  // live radius/results actually change -- not on every redraw (e.g. clicking "Compare to anchor"
  // changing `highlight`, or `onCompare`'s inline identity churning) -- otherwise it fights the
  // user's own zoom/pan on every unrelated re-render.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const selectedMember = members.find((m) => `${m.facility.kind}:${m.facility.ccn}` === selectedId)
    const bounds: L.LatLngExpression[] = []
    for (const m of members) {
      if (m.facility.latitude != null && m.facility.longitude != null) bounds.push([m.facility.latitude, m.facility.longitude])
    }
    if (selectedMember) {
      for (const c of competitors) {
        if (c.facility.latitude != null && c.facility.longitude != null) bounds.push([c.facility.latitude, c.facility.longitude])
      }
      for (const h of hospitals) {
        if (h.facility.latitude != null && h.facility.longitude != null) bounds.push([h.facility.latitude, h.facility.longitude])
      }
    }
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 13 })
    }
  }, [members, selectedId, radiusMiles, competitors, hospitals])

  return <div ref={containerRef} className="h-full min-h-[400px] w-full rounded-xl" />
}
