# Production feature preservation

ScoutSNF is live and in use. This is the catalog of capabilities that must survive any redesign
or refactor **as user-facing behavior**. Implementations are free to change; behavior is not.

If a change you're about to make appears to require dropping or altering anything here, stop and
ask. Don't decide unilaterally, and don't assume something is dead code because its caller isn't
obvious.

Correcting this document is expected and good — it has been wrong before. Fix it in a commit so
the correction is permanent, rather than working around it.

## Navigation

Two views, both reachable from the bottom nav: **ScoutBoard** (with a saved-count badge when
non-zero) and **Search**.

## Facility search

- Free-text query matches and ranks by **name, city, and ZIP — nothing else.** There is no CCN
  matching, and it should not be added. (This document previously claimed CCN was searchable.
  That was verified false against production and current HEAD.)
- Ranking order: name prefix > name substring > city prefix > city substring > ZIP prefix.
  Ties break alphabetically by name.
- Minimum 2 characters for a text query.
- Filters: state, facility kind (SNF/hospital), bed-count min/max, Special Focus status
  (SNF-only; no effect when kind is hospital). The Special Focus filter offers Any / Special
  Focus Facility / SFF Candidate / Either — these are different populations and selecting one
  must never return the other.
- Filters and text combine as AND, and **either can drive results alone** — a bare filter set
  with no text ("all SNFs in Ohio with 100+ beds") is a valid search.

## Radius market analysis

- Radius steps are exactly 10, 15, 20, 25, 30, 35, 40 miles. Slider shows the current radius and
  a live facility count.
- Distances are haversine miles from the anchor facility.
- Results separate the anchor from competitors and show per-facility distance.

## Map

- Leaflet with OpenStreetMap tiles.
- SNFs and hospitals are visually distinguished (`snf` #0ea5e9 / `hospital` #ef4444).
- Portfolio facilities are gold-ringed (`gold` #e9c46a).
- Radius circle is drawn around the anchor.
- A legend is reachable from Settings ("Legend — data sources").

## Facility data shown

SNFs: name, address, city, state, ZIP, certified beds, average daily census, occupancy %, all
five CMS star ratings (overall, health inspection, staffing, quality measures), ownership type,
Special Focus status, CMS processing date.

**Special Focus is two statuses, never one flag.** `sff` is a facility currently in the CMS
program (under 100 nationally, roughly twice-yearly surveys, termination exposure). `candidate`
is on the watch list and eligible for selection (several hundred). Only an `sff` gets the red
hand on CMS Care Compare. They must stay visually distinct (red vs amber badge), separately
filterable, and separately labeled in exports. Collapsing them into one boolean is the specific
regression this entry exists to prevent — it previously overstated risk on ~440 facilities.

Hospitals: name, address, city, state, ZIP, hospital type (Acute Care, Critical Access,
Psychiatric, Children's, VA, DoD, LTCH, Inpatient Rehab, Other), overall rating, emergency
services, certified beds.

## Data loading

- SNF and hospital rosters are fetched as **static same-origin JSON** from `public/data/` —
  `snf-roster.json`, `hospital-roster.json`, `roster-manifest.json`.
- **No geocoding and no bulk CMS fetching happens in the browser.** That is done once, ahead of
  time, by `scripts/roster/` via `.github/workflows/roster-pipeline.yml`. Reintroducing
  client-side geocoding is a regression and also violates Nominatim's usage policy.
- Cached-first render with a quiet background staleness check. The app must be usable
  immediately, not after a multi-minute load.
- Cost reports come from `public/data/hcris-cost-reports.json` (HCRIS CI pipeline).
- Owner/manager name search is the one live, per-query CMS call
  (`src/hooks/useOwnerNameSearch.ts`, dataset `y2hd-n93e`). It is on-demand, not startup, and
  stays in the browser.
- Coordinate-collision detection stays available to the user but must not perform network
  lookups — the pipeline corrects collisions; the app only reports them.

## Settings menu

All of these must remain present:

- SNF roster freshness date (prefers the pipeline's `built_at` over local fetch time)
- Hospital roster freshness date
- Hospital bed-data status (`matched/total`, or the error for that build)
- Per-roster refresh error lines when a refresh has failed
- **"Refresh data…"** — pulls the latest published roster, behind a confirm dialog
- **"Re-check facility locations"** — reports facilities still sharing coordinates
- **"Legend — data sources"**

## ScoutBoard (saved facilities)

- Save/unsave any facility; saved count shows in the nav.
- Per-facility free-text notes, persisted.
- Manual reordering, persisted.
- Each saved facility remembers the radius it was saved at.

## Portfolios

- Multiple named portfolios: create, rename, delete, reorder.
- Add/remove facilities to any portfolio.
- Portfolio map view, cluster analysis, anchor drill-down, and overlap/shared-market reporting.

## Exports

- Every export is a styled `.xlsx` workbook. Never CSV, never a raw dump.
- Branded via `src/lib/excelStyle.ts`; `exceljs` is dynamically imported so it stays out of the
  main bundle.
- Multi-sheet portfolio reports highlight shared/overlap sheets.

## Sign-in gate

- `src/AccessGate.tsx` wraps the entire app. Name + email, logged to a Google Sheet via an Apps
  Script Web App.
- **This is a sign-in log, not security.** The app files are public by design. Never harden it,
  move hosts, add a backend, or add an auth library.
- Blocking is done by adding an email — or `@domain.com` — to the sheet's "Denied" tab.
- Bumping `GATE_VERSION` must flush caches, unregister service workers, clear `scoutsnf.*` local
  storage, and force everyone back through the gate.
- A 7-day offline grace period applies when the endpoint is unreachable.

## Platform behavior

- Installable PWA, works offline via the service worker.
- Theme follows the OS preference. `tailwind.config.js` intentionally has **no** `darkMode` key
  (Tailwind's `media` strategy). No manual theme toggle.
- Mobile-first layout; bottom nav respects `env(safe-area-inset-bottom)`.
- Brand tokens: `brand` #0f4c5c, `gold` #e9c46a, `snf` #0ea5e9, `hospital` #ef4444.
- Link-preview cards (WhatsApp etc.) must render without white corners.
