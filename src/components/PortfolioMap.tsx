import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { SnfRecord, HospitalRecord } from '../types/facility'
import type { PortfolioMemberResolved } from '../lib/portfolioReport'
import { MAP_COLORS, dotIcon } from '../lib/mapIcons'

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

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
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
      marker.bindPopup(`<strong>${m.row.name}</strong><br/>Portfolio facility${isSelected ? ' (selected)' : ''}`)
      marker.on('click', () => onSelect(id))
    }

    function bindComparePopup(marker: L.Marker, facility: SnfRecord | HospitalRecord, distanceMiles: number, anchorName: string) {
      const popupDiv = document.createElement('div')
      popupDiv.innerHTML = `<strong>${facility.name}</strong><br/>${distanceMiles} mi from ${anchorName}<br/>`
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

      for (const c of competitors) {
        if (c.facility.latitude == null || c.facility.longitude == null) continue
        bounds.push([c.facility.latitude, c.facility.longitude])
        const highlighted = isHighlighted(c.facility)
        const marker = L.marker([c.facility.latitude, c.facility.longitude], {
          icon: dotIcon(MAP_COLORS.snf, 12, highlighted),
          zIndexOffset: highlighted ? 900 : 0
        }).addTo(layer)
        bindComparePopup(marker, c.facility, c.distanceMiles, selectedMember.row.name)
      }
      for (const h of hospitals) {
        if (h.facility.latitude == null || h.facility.longitude == null) continue
        bounds.push([h.facility.latitude, h.facility.longitude])
        const highlighted = isHighlighted(h.facility)
        const marker = L.marker([h.facility.latitude, h.facility.longitude], {
          icon: dotIcon(MAP_COLORS.hospital, 12, highlighted),
          zIndexOffset: highlighted ? 900 : 0
        }).addTo(layer)
        bindComparePopup(marker, h.facility, h.distanceMiles, selectedMember.row.name)
      }
    }

  }, [members, selectedId, radiusMiles, competitors, hospitals, onSelect, onCompare, highlight])

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
