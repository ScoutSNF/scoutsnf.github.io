# ScoutSNF — SNF Market Analysis PWA

A client-only Progressive Web App for skilled nursing facility (SNF) acquisition
analysis. Search any U.S. nursing facility (the "anchor") and see every SNF and
hospital within a 10–40 mile radius: distance, beds, occupancy (with as-of
date), CMS star ratings, facility type, and website/photo.

## Stack

- Vite + React + TypeScript, Tailwind CSS
- `vite-plugin-pwa` (installable, offline shell)
- Dexie (IndexedDB) for caching the national SNF/hospital rosters client-side
- Leaflet + OpenStreetMap tiles for the map view
- No backend — every data source below is fetched directly from the browser

## Data sources

| Source | Dataset | Notes |
|---|---|---|
| CMS Provider Data Catalog | "Provider Information" (`4pq5-n9py`) | SNF roster, beds, occupancy inputs, ratings, coordinates |
| CMS Provider Data Catalog | "Hospital General Information" (`xubh-q36u`) | Hospital roster, type, rating — no coordinates or beds |
| CMS Provider of Services file | discovered via `data.cms.gov/data.json` | Hospital certified bed counts, joined on CCN |
| HHS / healthdata.gov | "COVID-19 Reported Patient Impact and Hospital Capacity by Facility" (`anag-cw7u`) | Frozen since May 2024 — last federally reported week per hospital, fetched on demand per state |
| U.S. Census Geocoder | batch endpoint, Nominatim fallback | Geocodes the hospital roster (no coordinates in the CMS file) |
| Google Places (optional) | JS SDK | Website + cover photo, only if `VITE_GOOGLE_PLACES_KEY` is set |

Column names are matched defensively (normalized, multiple candidate names per
field) because CMS renames columns across releases — see `src/lib/csv.ts`
(`findColumn`) and each `src/data/*.ts` module.

## Running locally

```
npm install
npm run dev
```

Optional: copy `.env.example` to `.env` and set `VITE_GOOGLE_PLACES_KEY` to
enable website links + cover photos. Without a key the app falls back to a
placeholder image and a "Find online" search link.

## Build

```
npm run build
```

## Notes on the frozen hospital-occupancy dataset

CMS stopped requiring facility-level hospital capacity reporting in May 2024.
Every hospital occupancy value shown in this app displays its source week
inline (e.g. "78% (wk of 4/21/24)") and is styled as historical data — it is
not a live number.

## Brand

"Cross-cutout compass pin" mark — a location pin with a medical cross knocked
out of it and a gold compass needle through the center. Palette: `#0f4c5c`
(scout teal, primary/UI accent), `#e9c46a` (scout gold, ratings + saved-facility
accent), white. Source SVGs live in `public/brand/`:

- `icon.svg` — primary mark (with needle), 32px and up
- `icon-small.svg` — pin + cross only, used below 32px (`favicon.svg` is this variant)
- `icon-mono.svg` — single-color cutout via `fill-rule="evenodd"`, for print/letterhead use

`public/pwa-192x192.png` / `pwa-512x512.png` are rasterized from the primary mark.
