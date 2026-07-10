import L from 'leaflet'

export const MAP_COLORS = {
  anchor: '#0f4c5c',
  snf: '#0ea5e9',
  hospital: '#ef4444',
  highlightRing: '#e9c46a'
}

/** Highlighted pins get a larger gold ring so they stand out from the rest — used for the
 * compared facility on the search map and for portfolio-owned facilities on the portfolio map. */
export function dotIcon(color: string, baseSize: number, highlighted: boolean): L.DivIcon {
  const size = highlighted ? baseSize + 4 : baseSize
  const ring = highlighted ? `box-shadow:0 0 0 3px ${MAP_COLORS.highlightRing}, 0 0 0 5px white;` : ''
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;${ring}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}
