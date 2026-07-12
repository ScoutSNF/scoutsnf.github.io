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

1. `scrape.ts` finds the current SNF-2010 zip links on CMS's "Cost Reports by Fiscal Year" page —
   never hardcodes a URL pattern; throws loudly if the page structure changes and nothing matches.
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

This sandbox's network policy blocks direct access to cms.gov, resdac.org, and the CMS-2540-10
instruction PDFs, so these coordinates were researched through search-indexed secondary sources
rather than the authoritative documents themselves. Per field:

- **`bedsAvailable`** (Worksheet S-3 Part I, line 1) — CONFIRMED against multiple sources
  specifically for the SNF-2010 form.
- Everything else — **BEST-EFFORT**. Some of it (the G/G-2/G-3 financial lines especially) was
  sourced from references that may describe the *hospital* 2552-10 form's layout rather than the
  SNF-2010 form's own; the two forms share worksheet names but not line numbers (this was caught
  once already — see the beds-available field, where the hospital form uses line 14/col 2 and the
  SNF form uses line 1).

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
        "totalOperatingExpenses": 17500000, "netIncome": 500000, "operatingMarginPct": 2.5
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
