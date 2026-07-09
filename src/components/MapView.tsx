import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { FacilityRecord, FacilityWithDistance } from '../types/facility'

const ICONS: Record<'anchor' | 'snf' | 'hospital', L.DivIcon> = {
  anchor: L.divIcon({
    className: '',
    html: '<div style="width:16px;height:16px;border-radius:50%;background:#0f4c5c;border:2px solid white;box-shadow:0 0 0 2px #0f4c5c"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  }),
  snf: L.divIcon({
    className: '',
    html: '<div style="width:12px;height:12px;border-radius:50%;background:#0ea5e9;border:2px solid white"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  }),
  hospital: L.divIcon({
    className: '',
    html: '<div style="width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  })
}

export function MapView({
  anchor,
  radiusMiles,
  results,
  onSelect
}: {
  anchor: FacilityRecord
  radiusMiles: number
  results: FacilityWithDistance<FacilityRecord>[]
  onSelect: (facility: FacilityRecord) => void
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

    L.marker([anchor.latitude, anchor.longitude], { icon: ICONS.anchor })
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
      const marker = L.marker([facility.latitude, facility.longitude], {
        icon: ICONS[facility.kind]
      }).addTo(layer)
      const popupDiv = document.createElement('div')
      popupDiv.innerHTML = `<strong>${facility.name}</strong><br/>${distanceMiles.toFixed(1)} mi · ${facility.kind === 'snf' ? 'SNF' : 'Hospital'}<br/>`
      const btn = document.createElement('button')
      btn.textContent = 'View details'
      btn.style.cssText = 'color:#0f4c5c;text-decoration:underline;font-size:12px;background:none;border:none;padding:0;cursor:pointer'
      btn.onclick = () => onSelect(facility)
      popupDiv.appendChild(btn)
      marker.bindPopup(popupDiv)
    }

    map.setView([anchor.latitude, anchor.longitude], radiusMiles <= 15 ? 11 : radiusMiles <= 25 ? 10 : 9)
  }, [anchor, radiusMiles, results, onSelect])

  return <div ref={containerRef} className="h-full min-h-[400px] w-full rounded-xl" />
}
