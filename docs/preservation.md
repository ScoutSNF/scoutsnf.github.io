# Production feature preservation

ScoutSNF is live and in use. This is the catalog of capabilities that must survive any redesign
or refactor **as user-facing behavior**. Implementations are free to change; behavior is not.

If a change you're about to make appears to require dropping or altering anything here, stop and
ask. Don't decide unilaterally, and don't assume something is dead code because its caller isn't
obvious.

Correcting this document is expected and good — it has been wrong before. Fix it in a commit so
the correction is permanent, rather than working around it.

## Navigation

Persistent navigation at every width: a sidebar rail at >=1024px, a thumb-reachable bottom bar
below it. Both expose the same destinations, so a view can never be reachable from one and
stranded in the other.

**Search** sits at the top with **ScoutBoard**; **Sources** and **Settings** are pinned to the
bottom of the rail, below a divider and in quieter, smaller styling, as admin options.

**ScoutBoard is a disclosure, not a destination.** It has no page of its own and tapping it never
navigates — it expands the portfolio list beneath it, indented, each row showing a name and
facility count, plus a "+ New portfolio" action. It reads as selected while open with nothing
picked under it; picking a portfolio moves the selection to that row and opens the portfolio's
landing page. Tapping it again collapses the list. Only one navigation item is ever highlighted.

**It starts collapsed on every load**, including for someone who has saved facilities and
portfolios. Nothing opens it but a tap.

**ScoutBoard previously had an overview page at `#/board`. It was deleted deliberately** — its
route falls through to Search so old links still land somewhere. Everything it owned survives, on
other pages; see "ScoutBoard (saved facilities)" below for where.

An **Unfiled** row appears at the bottom of the list, with a count, when any saved facility is in
no portfolio, and is hidden when there are none. It opens `#/unfiled`.

On a phone the bar stays a bar: ScoutBoard raises a drawer that sits directly above it, so Search
is never pushed off screen, and every drawer row is a 44px target.

The URL hash is the source of truth for the current view and facility, so browser Back/Forward
restore state and a facility can be linked to. GitHub Pages cannot rewrite unknown paths, so links
are hash-shaped (`#/facility/snf/335565`) rather than real paths. A shared link carries only a
facility kind and CCN — both public CMS identifiers — and never a name, email, device id, note or
portfolio.

## Facility search

- Free-text query matches an **exact CCN**, then name, city and ZIP — nothing else.
  **CCN lookup was added deliberately.** This entry previously read "there is no CCN matching, and
  it should not be added", which the UI redesign brief overrode. The history is worth keeping: an
  earlier appendix wrongly *claimed* CCN was already searchable, that claim was verified false, and
  the correction then hardened into a prohibition. Adding it now is a decision, not a regression.
- CCN matching is **exact only**, never by prefix: ZIPs are five digits and CCNs six, so prefix
  matching would let a half-typed ZIP resolve to an unrelated facility's CCN.
- Ranking order: exact CCN > name prefix > name substring > city prefix > city substring >
  ZIP prefix. Ties break alphabetically by name.
- Minimum 2 characters for a text query.
- Filters: state, facility kind (SNF/hospital), bed-count min/max, minimum CMS overall stars
  (with **Unrated by CMS** as a distinct option — an unrated facility is not a 1-star facility and
  must never be folded into the bottom band), Special Focus status
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
- Per-facility free-text notes, persisted. **On the Unfiled page.**
- Manual reordering, persisted. **On the Unfiled page.**
- Each saved facility remembers the radius it was saved at.

These three lived on the ScoutBoard overview page until it was deleted, and moved rather than
going away with it. The Unfiled page is the only place that offers any of them, so a change that
removes or replaces that page has to carry them somewhere else first.

## Portfolios

- Multiple named portfolios: create, delete.
  - **Create** is the "+ New portfolio" action at the bottom of the navigation's portfolio list.
  - **Delete** is on the portfolio's own landing page, behind a confirm. Its facilities stay saved
    and fall back to Unfiled.
  - **Rename and reorder are not implemented.** This entry claimed both for a long time;
    `renamePortfolio` exists in `src/data/portfolios.ts` but nothing has ever called it, and there
    has never been a reorder. Corrected rather than treated as a regression to chase.
- Add a facility to a portfolio: **on the Unfiled page**, the only place that offers it.
  Remove a facility from one: on that portfolio's landing page.
- Portfolio map view, cluster analysis, anchor drill-down, and overlap/shared-market reporting.

### Portfolio summary

Sits at the top of every portfolio page, above the List/Map tabs. A generated headline (no model
call, no network) plus one row per SNF in the portfolio across five columns: overall rating,
staffing rating, total nurse staffing HPRD, occupancy and health inspection rating. Higher is
better for all five, which is what lets one comparison serve every column.

Each cell shows the home's own value with the area median under it. **Only the gap is coloured** —
green better, red worse, grey within ±2% or uncomparable. The value itself is never coloured: a
2-star home is not a finding, a 2-star home in a 4-star market is.

The area median is the median of SNFs within that home's **own saved radius**, excluding the home
itself. Below 5 neighbours it falls back to the county median and the cell is labelled `county`.
With neither, the row says so rather than inventing a comparison. Each row states its comparison
set size ("vs 139 SNFs within 10 mi").

A missing metric renders "—", never 0, and is excluded from the headline's count.

**There is no composite score, buy signal or projected return here, and none should be added.**

On a phone the table scrolls sideways inside its own box with the name column sticky; the page
itself must never scroll sideways. That needs `min-w-0`/`max-w-full` on the section and `w-full
min-w-0` on the portfolio page's root — without them the table's min-content width propagates up
and drags the whole document sideways.

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

## Accessibility

- Star ratings expose their numeric value to assistive technology. The five glyphs are
  `aria-hidden` and the value is announced once as text — rendering five ★ characters with the
  meaning carried only by fill colour reported the same rating for every facility.
- Every interactive element has a visible focus ring, and touch targets are at least 44px.
- `prefers-reduced-motion` is respected.

## Platform behavior

- Installable PWA. The app shell and the self-published roster/cost-report JSON are cached, so a
  previously loaded browser works offline against dated cached data. **OpenStreetMap tiles are
  deliberately not cached** — their usage policy forbids pre-caching — so offline means cached
  data, not an offline map.
- Theme defaults to the OS preference, and Settings offers an explicit light / dark / Match system
  choice. **Reversed deliberately** — this entry previously read "no manual theme toggle", which
  the UI redesign brief overrode. An explicit choice stamps `data-theme` on `<html>`; 'system'
  writes nothing and lets the media query govern. The stored preference survives a `GATE_VERSION`
  flush, since a display setting is not identity.
- Mobile-first layout; bottom nav respects `env(safe-area-inset-bottom)`.
- Brand tokens: `brand` #0f4c5c, `gold` #e9c46a, `snf` #0ea5e9, `hospital` #ef4444.
- Link-preview cards (WhatsApp etc.) must render without white corners.
