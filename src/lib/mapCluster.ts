import L from 'leaflet'

export interface ClusterPoint<T> {
  lat: number
  lon: number
  item: T
}

export interface Cluster<T> {
  lat: number
  lon: number
  points: ClusterPoint<T>[]
}

/**
 * Grid clustering in screen space, at whatever zoom the map is currently on.
 *
 * Hand-rolled rather than pulled in from leaflet.markercluster: this is the only place in the app
 * that needs it, the behaviour wanted is simple, and CLAUDE.md rules out adding an npm dependency
 * without asking. Points are bucketed by the pixel cell their projected position falls into, so
 * clustering tightens as you zoom out and dissolves as you zoom in, which is the property that
 * actually matters.
 *
 * Each cluster reports the centroid of its members so the badge sits among them rather than on
 * the first one. Single-point cells come back as clusters of length 1 — callers draw those as
 * ordinary markers.
 */
export function clusterByGrid<T>(map: L.Map, points: ClusterPoint<T>[], cellPx = 56): Cluster<T>[] {
  if (points.length === 0) return []
  const zoom = map.getZoom()
  const cells = new Map<string, ClusterPoint<T>[]>()

  for (const p of points) {
    const projected = map.project([p.lat, p.lon], zoom)
    const key = `${Math.floor(projected.x / cellPx)}:${Math.floor(projected.y / cellPx)}`
    const bucket = cells.get(key)
    if (bucket) bucket.push(p)
    else cells.set(key, [p])
  }

  const out: Cluster<T>[] = []
  for (const bucket of cells.values()) {
    if (bucket.length === 1) {
      out.push({ lat: bucket[0].lat, lon: bucket[0].lon, points: bucket })
      continue
    }
    let latSum = 0
    let lonSum = 0
    for (const p of bucket) {
      latSum += p.lat
      lonSum += p.lon
    }
    out.push({ lat: latSum / bucket.length, lon: lonSum / bucket.length, points: bucket })
  }
  return out
}

/** Badge showing how many facilities a cluster stands for. Sized in bands so a 3 and a 300 are
 *  distinguishable at a glance without the marker swallowing the map. */
export function clusterIcon(count: number, color: string): L.DivIcon {
  const size = count < 10 ? 30 : count < 50 ? 36 : 44
  return L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${color};opacity:0.92;
      border:2px solid rgba(255,255,255,0.9);
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:${count < 100 ? 13 : 11}px;
      font-family:system-ui,sans-serif;line-height:1;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  })
}
