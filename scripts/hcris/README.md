# HCRIS cost report pipeline

Quarterly ingestion of CMS's raw HCRIS SNF-2010 (form CMS-2540-10) cost report data, replacing the
old, permanently-frozen HHS occupancy feed and adding SNF payer mix / operating margin that never
existed in this app before. Produces `public/data/hcris-cost-reports.json`, a static file the app
fetches like any other dataset — there's no backend, this is entirely a scheduled build step.

## Run it

```
npm run hcris:run
```

Runs against the live CMS site — needs real network access. GitHub Actions
(`.github/workflows/hcris-pipeline.yml`) runs this quarterly and opens a PR with the diff.

## Design

1. `scrape.ts` does a two-level fetch: CMS's "Cost Reports by Fiscal Year" index page never links
   directly to a zip — it links to one per-form-per-fiscal-year sub-page (naming is inconsistent
   across years, e.g. `snf-2010-fy-2025-data-files` vs the older `snf10-2010-fy-2022`), and the
   actual zip download link lives on that sub-page. Never hardcodes a URL pattern; throws loudly,
   naming the exact page, if either level's structure changes and nothing matches.
2. `download.ts` streams each zip to disk and extracts via the system `unzip` binary.
3. `parseRpt.ts` parses the headerless RPT file (one row per cost report: provider number, fiscal
   year, report status).
4. `parseNmrc.ts` **streams** the headerless NMRC file line-by-line, keeping only the handful of
   `(WKSHT_CD, LINE_NUM, CLMN_NUM)` cells this app actually needs — never buffers the whole file or
   builds a wide table first. This file is the large one (every populated cell of every worksheet of
   every report).
5. `buildRecord.ts` derives occupancy / payer mix / operating margin and — this is the important
   part — validates every value before trusting it (plausible-range bounds per field, plus
   cross-field checks like "Medicare + Medicaid days can't exceed total days"). A field that fails
   is dropped and logged; it never gets silently emitted with a wrong number, and a failure on one
   field doesn't take down the rest of the record.
6. `upsert.ts` merges everything on `(CCN, fiscal year begin date)`, keeping the higher report status
   (settled beats submitted), tiebreaking on the newer process date. Because each run re-downloads
   and fully re-derives the 3 most recent fiscal years from scratch, the output is a complete
   rebuild every time — idempotent by construction, no incremental-merge drift to worry about.

## On the exact worksheet/line/column numbers in `metricCatalog.ts`

This sandbox's network policy blocks direct access to cms.gov, so these coordinates were originally
researched through search-indexed secondary sources rather than the authoritative CMS-2540-10
instructions — and the first live pipeline run showed the initial best-effort guesses were wrong
(the "confirmed" `bedsAvailable` field itself turned out to point at the bed-*days* column, not
beds). Every coordinate below was subsequently re-verified by downloading a real FY2025 SNF-2010
zip via a GitHub Actions runner (the only thing in this environment with real internet access) and
checking the actual per-column value distribution or an exact accounting identity against all
~400 real reports in the file — not a single sample. Per field:

- **`bedsAvailable`, `bedDaysAvailable`, `totalPatientDays`, `medicarePatientDays`,
  `medicaidPatientDays`** (Worksheet S-3 Part I, line 1) — CONFIRMED: the column-by-column value
  distribution for line 1 matches real bed counts (15-467, avg 110) at column 1, bed-days at column
  2, etc. All five live on the same line for internal consistency (mixing lines would break the
  occupancy ratio even if each line's data were individually valid). `medicarePatientDays` and
  `medicaidPatientDays` were themselves initially swapped -- a single-sample plausibility check
  (does this one facility's payer mix look reasonable?) isn't enough, because a facility can
  legitimately have either payer as the majority. The real check is a national aggregate: column 5
  sums to ~63% of total patient days across 400+ real reports (Medicaid's typical dominant SNF
  share) and column 6 to ~28% (Medicare's) -- confirm against the population, not one row.
- **`totalPatientRevenue`, `netPatientRevenue`, `totalOperatingExpenses`** (Worksheet G-3, lines 3,
  4, 1) — CONFIRMED: plausible dollar-magnitude distributions, and `netPatientRevenue` is always
  less than or equal to `totalPatientRevenue` as expected.
- **`netIncome`** is *not* extracted from its own cell — Worksheet G-3 line 5 looked plausible at a
  glance but turned out to be the contractual-allowance deduction (`totalPatientRevenue -
  netPatientRevenue`), confirmed wrong on 100% of a sampled set of reports, not net income at all.
  It's derived downstream in `buildRecord.ts` as `totalPatientRevenue - totalOperatingExpenses`,
  which exactly reproduces line 2 (negated) on all 405/405 real reports checked.

**The safety net is `buildRecord.ts`'s validation gate, not the catalog's correctness.** A wrong
coordinate should produce an out-of-range or internally-inconsistent value, which gets caught and
dropped rather than silently trusted. But it's still worth fixing the source of truth:

**To correct a mapping** after reviewing a real run's output (or its warnings — check the Actions
log or the `warnings` array): edit the relevant entry in `metricCatalog.ts`. That's the only place
the coordinates live; nothing else needs to change. If a field is dropping on every single record,
that's the signal its coordinate is wrong.

## Output schema

```jsonc
{
  "generatedAt": "2026-07-25T08:00:00.000Z",
  "fiscalYearsIncluded": [2023, 2024, 2025],
  "records": {
    "<CCN>": [
      {
        "fyBeginDate": "2025-01-01", "fyEndDate": "2025-12-31",
        "reportStatus": 1, "reportStatusLabel": "As submitted", "processDate": "2026-06-01",
        "bedsAvailable": 120, "totalPatientDays": 30000,
        "medicarePatientDays": 9000, "medicaidPatientDays": 18000, "otherPatientDays": 3000,
        "occupancyPct": 68.5, "medicarePct": 30.0, "medicaidPct": 60.0, "otherPct": 10.0,
        "totalPatientRevenue": 20000000, "netPatientRevenue": 18000000,
        "totalOperatingExpenses": 17500000, "netIncome": 2500000, "operatingMarginPct": 12.5
      }
      // ...one entry per fiscal year on file for this facility, ascending
    ]
  }
}
```

Any field that failed validation is `null`, not a guessed or zeroed value.

## Testing

`npm run test` covers every parsing/validation/dedup unit in isolation with synthetic fixtures, plus
one full integration test (`run.integration.test.ts`) that serves a real synthetic zip over a real
local HTTP server and runs the actual download → extract → parse → validate pipeline end to end.
That's the strongest verification achievable without live cms.gov access — it proves the mechanics
work; it can't prove the real CMS zip's internal format matches what's assumed here. The first live
run is the real test of that, which is exactly why the validation gate exists.
