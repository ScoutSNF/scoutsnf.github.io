import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { SnfRecord } from '../types/facility'
import type { PortfolioMemberResolved } from '../lib/portfolioReport'

const COLORS = {
  member: '#e9c46a',
  memberSelected: '#0f4c5c',
  competitor: '#0ea5e9',
  ring: '#0f4c5c'
}

/** Diamond marker so portfolio-owned facilities read as distinct from competitor dots at a glance. */
function memberIcon(selected: boolean): L.DivIcon {
  const size = selected ? 20 : 15
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;transform:rotate(45deg);background:${
      selected ? COLORS.memberSelected : COLORS.member
    };border:2px solid white;box-shadow:0 0 0 2px ${selected ? COLORS.member : COLORS.memberSelected};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}

function competitorIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${COLORS.competitor};border:2px solid white;"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5]
  })
}

export function PortfolioMap({
  members,
  selectedId,
  competitors,
  onSelect
}: {
  members: PortfolioMemberResolved[]
  selectedId: string | null
  competitors: { facility: SnfRecord; distanceMiles: number }[]
  onSelect: (id: string) => void
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
      const radiusMeters = selectedMember.row.radiusMiles * 1609.34
      L.circle([selectedMember.facility.latitude, selectedMember.facility.longitude], {
        radius: radiusMeters,
        color: COLORS.ring,
        fillOpacity: 0.05,
        weight: 1
      }).addTo(layer)
    }

    for (const m of members) {
      if (m.facility.latitude == null || m.facility.longitude == null) continue
      const id = `${m.facility.kind}:${m.facility.ccn}`
      const isSelected = id === selectedId
      bounds.push([m.facility.latitude, m.facility.longitude])
      const marker = L.marker([m.facility.latitude, m.facility.longitude], {
        icon: memberIcon(isSelected),
        zIndexOffset: 1000
      }).addTo(layer)
      marker.bindPopup(`<strong>${m.row.name}</strong><br/>Portfolio facility${isSelected ? ' (selected)' : ''}`)
      marker.on('click', () => onSelect(id))
    }

    if (selectedMember) {
      for (const c of competitors) {
        if (c.facility.latitude == null || c.facility.longitude == null) continue
        bounds.push([c.facility.latitude, c.facility.longitude])
        L.marker([c.facility.latitude, c.facility.longitude], { icon: competitorIcon() })
          .bindPopup(`<strong>${c.facility.name}</strong><br/>${c.distanceMiles} mi from ${selectedMember.row.name}`)
          .addTo(layer)
      }
    }

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 13 })
    }
  }, [members, selectedId, competitors, onSelect])

  return <div ref={containerRef} className="h-full min-h-[400px] w-full rounded-xl" />
}
