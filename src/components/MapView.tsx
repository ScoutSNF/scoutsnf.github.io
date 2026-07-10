import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { FacilityRecord, FacilityWithDistance } from '../types/facility'
import { MAP_COLORS as COLORS, dotIcon } from '../lib/mapIcons'

export function MapView({
  anchor,
  radiusMiles,
  results,
  highlight,
  onSelect
}: {
  anchor: FacilityRecord
  radiusMiles: number
  results: FacilityWithDistance<FacilityRecord>[]
  highlight?: FacilityRecord | null
  onSelect: (facility: FacilityRecord, distanceMiles: number) => void
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
    if (!map || !layer || anchor.latitude == null || anchor.longitude == null) return
    layer.clearLayers()

    const isComparing = highlight != null && highlight.latitude != null && highlight.longitude != null

    if (isComparing) {
      const line: L.LatLngExpression[] = [
        [anchor.latitude, anchor.longitude],
        [highlight!.latitude!, highlight!.longitude!]
      ]
      // Dark casing underneath makes the dashed line legible over light tiles/water/parks alike.
      L.polyline(line, { color: '#1e293b', weight: 5, opacity: 0.55 }).addTo(layer)
      L.polyline(line, { color: COLORS.highlightRing, weight: 3, dashArray: '10 6', opacity: 1 }).addTo(layer)
    }

    L.marker([anchor.latitude, anchor.longitude], { icon: dotIcon(COLORS.anchor, 16, isComparing) })
      .bindPopup(`<strong>${anchor.name}</strong><br/>Anchor`)
      .addTo(layer)

    const radiusMeters = radiusMiles * 1609.34
    L.circle([anchor.latitude, anchor.longitude], {
      radius: radiusMeters,
      color: '#0f4c5c',
      fillOpacity: 0.05,
      weight: 1
    }).addTo(layer)

    for (const { facility, distanceMiles } of results) {
      if (facility.latitude == null || facility.longitude == null) continue
      const isHighlighted = highlight != null && highlight.kind === facility.kind && highlight.ccn === facility.ccn
      const marker = L.marker([facility.latitude, facility.longitude], {
        icon: dotIcon(COLORS[facility.kind], 12, isHighlighted),
        zIndexOffset: isHighlighted ? 1000 : 0
      }).addTo(layer)
      const typeLabel = facility.kind === 'hospital' ? facility.hospitalType : ''
      const popupDiv = document.createElement('div')
      popupDiv.innerHTML = `<strong>${facility.name}</strong><br/>${distanceMiles.toFixed(2)} mi${typeLabel ? ' · ' + typeLabel : ''}<br/>`
      const btn = document.createElement('button')
      btn.textContent = 'View details'
      btn.style.cssText = 'color:#0f4c5c;text-decoration:underline;font-size:12px;background:none;border:none;padding:0;cursor:pointer'
      btn.onclick = () => onSelect(facility, distanceMiles)
      popupDiv.appendChild(btn)
      marker.bindPopup(popupDiv)
    }

    map.setView([anchor.latitude, anchor.longitude], radiusMiles <= 15 ? 11 : radiusMiles <= 25 ? 10 : 9)
  }, [anchor, radiusMiles, results, highlight, onSelect])

  return <div ref={containerRef} className="h-full min-h-[400px] w-full rounded-xl" />
}
