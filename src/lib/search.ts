import type { FacilityRecord } from '../types/facility'

export interface SearchHit {
  facility: FacilityRecord
  score: number
}

function norm(s: string): string {
  return s.toLowerCase().trim()
}

/** Type-ahead over the cached national roster: name match ranks above city match. */
export function searchFacilities(
  query: string,
  snfs: FacilityRecord[],
  hospitals: FacilityRecord[],
  limit = 20
): SearchHit[] {
  const q = norm(query)
  if (q.length < 2) return []

  const all = [...snfs, ...hospitals]
  const hits: SearchHit[] = []

  for (const facility of all) {
    const name = norm(facility.name)
    const city = norm(facility.city)
    let score = -1
    if (name.startsWith(q)) score = 100
    else if (name.includes(q)) score = 70
    else if (city.startsWith(q)) score = 50
    else if (city.includes(q)) score = 30

    if (score >= 0) hits.push({ facility, score })
  }

  hits.sort((a, b) => b.score - a.score || a.facility.name.localeCompare(b.facility.name))
  return hits.slice(0, limit)
}
