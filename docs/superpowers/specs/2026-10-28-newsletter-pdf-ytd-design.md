# Newsletter PDF: year-to-date focus, operator tables and charts

## Intent

The owner reviewed the downloadable newsletter PDF (the "Laadi alla PDF"
button on the Reports page, `src/components/NewsletterPdfButton.jsx`,
mounted from `prototype/src/pages/Reports.jsx`). They want it to report how
the **year so far** is going (January through the latest month), not only
the latest month. They also want it to carry the same yearly tables and
charts that the new "Majutusettevõtja vaade" page
(`prototype/src/pages/Operator.jsx`) shows.

Background found during design: the PDF tried to screenshot those tables
and charts from the DOM (`captureOperatorSnapshots`, ids
`#operator-yearly-national` / `#operator-yearly-card`). Those nodes only
exist while the Operator page is open, and the button lives on the Reports
page, so the captures silently return null. Today's PDF therefore has
**none** of them.

## Goals (owner's words, made concrete)

**Text (AI-written by `scripts/generate-narrative.mjs`, weekly):**
- The Estonia text (`sections.dashboard`) leads with the year-to-date
  period (e.g. "jaanuar–august 2026"):
  - accommodated guests, nights, and domestic vs foreign guests
  - each with its change vs the same months a year earlier
  - the latest month is secondary
- Every county text (`sections.dashboardByRegion`) gets the same
  year-to-date-first treatment.
- Two new short AI paragraphs, both shown on page 1 of the PDF:
  - **Accommodation sector economy:** the latest quarter's accommodation
    services turnover (TU410 `CUB_SERV`, `I55`) and its change vs the same
    quarter a year earlier (`computeRevenueGrowth` in
    `src/lib/accommodationSector.js`).
  - **Spending per trip in Estonia:** domestic trip spending (TU552), which
    the generator already fetches.
- The emailed newsletter (`scripts/send-newsletter.mjs`) uses the same
  Estonia text, so it becomes year-to-date-led automatically. No change to
  the email template.

**PDF page 1, Estonia:**
1. The brand/period line, AI headline, intro and KPI tiles stay as they
   are.
2. The key insights stay.
3. The Estonia text (year-to-date-led).
4. **Removed:** the "Eesti elanikud vs väliskülastajad, aastate lõikes"
   stacked bar chart (`nationalResidencyChart`).
5. **Added:** the full **"Eesti — aastate lõikes"** table, with exactly
   the columns and rows of the Operator page's national table:
   - **Columns:** the full years from 2020 to last year, then the latest
     month in each of the last three years (e.g. "2024 august", "2025
     august", "2026 august").
   - **Rows:**
     - accommodated, with its change
     - cumulative Jan–month, with its change
     - domestic share
     - establishments
     - rooms
     - occupancy
     - average price per night, with its change
     - RevPAR
6. Sector economy paragraph + the **"Käibe muutus võrreldes sama
   kvartaliga aasta varem"** chart: the last 36 quarters, nominal % change
   vs the same quarter a year earlier, bars green for positive and red for
   negative. Source TU410.
7. Trip-spending paragraph.

**PDF page 2, county:**
1. The county name, the year-to-date-led county text, and the existing
   lean KPI table stay.
2. **Added:** the two county charts from the Operator page:
   - **"Majutatud Eestis ja {maakond} osakaal":** bars = Estonia total
     guests per year, line = the county's share. The partial year is
     hatched/lightened.
   - **"{maakond}: täituvus, RevPAR ja keskmine ööpäevamaksumus":** bars =
     room occupancy, lines = RevPAR and average price. The partial year is
     hatched/lightened.
3. **Added:** the full **"{maakond} vs. Eesti — aastate lõikes"** table,
   including the county-share row and the top origin-country rows (top 3
   in the PDF, as the old capture code did).
   - The year span matches the Operator page defaults (3 full years for
     the county table; the charts show the last 10 years, as on screen).

**General:**
- Tables and charts are **drawn natively with jsPDF** from data, never
  screenshotted. That way they're sharp, complete, and independent of
  which page is open.
- The county on page 2 is chosen as today: an explicitly selected region,
  otherwise the narrative's `featuredRegionCode`.

## Decided by the owner

- The scope above, as played back and approved on 2026-10-28.
- **RevPAR stays in the tables.** The owner states the average price per
  night (`OCC_NI_COST`) is per room, which makes RevPAR = occupancy ×
  average price valid. This supersedes the earlier caution in
  `docs/report-pipeline-changes.md`, which should get a dated note
  recording the owner's ruling.
- "Screenshots can be quite poor": include the **full** tables.

## Non-goals

- No change to the website pages themselves, beyond extracting shared
  table/chart data code out of `Operator.jsx` so both use one copy.
- No change to the email template or the Mailchimp flow.
- No new data on the PDF beyond what the owner listed.

## Anti-goals

- The PDF and the website showing different numbers for the same cell.
  There must be one shared computation.
- A partial year shown as if complete. Keep the site's `*` and the
  lightened/hatched treatment.
- Blurry or cut-off tables.

## Constraints

- `NewsletterPdfButton.jsx` lives in the old `src/` tree and uses the old
  `LocaleContext`/`RegionContext` (wrapped by `Reports.jsx`). The prototype
  datasets (`useTourism`, `useCapacity`, `useSector`, `useResidents`,
  `useOrigins`) live in `prototype/src/data/`.
- The PDF must keep working in both languages (`et`/`en`) and keep its
  existing footer, page numbers and source notes. Update the source line
  to include TU410 and TU552.
- `generate-narrative.mjs` runs in Node 20 in a GitHub Action. Any change
  to its prompts or outputs must keep `narrative.json` backward compatible
  for the site, e.g. `AiSummary` reads `sections.dashboard` and
  `sections.dashboardByRegion`.

## Claude's calls (left to the builder, decided here)

- **Data path:** `Reports.jsx` computes the table columns, chart series
  and growth series with the prototype's own hooks and helpers. It passes
  them as plain data props to `NewsletterPdfButton`, along with translated
  labels. The old component only draws; it no longer screenshots, and
  `captureOperatorSnapshots` is deleted.
- **Shared code:** `buildColumns` and its helpers move out of
  `Operator.jsx` into `prototype/src/data/operatorTable.js`, unchanged in
  behaviour. The Operator page then imports them.
- **Guest type:** the Operator page's "all / domestic / foreign" switch is
  fixed to **all guests** (`WORLD`) in the PDF, the page's default.
- **Layout:** the national table has ~10 columns on A4 portrait, set at
  7–7.5pt. If it can't fit legibly, drop the earliest full year rather
  than shrink the type below 7pt.
- **Text regeneration:** after merging, run the "Generate narrative"
  workflow once with `force`, so the new text exists right away (a few
  cents with the current Sonnet model).
- **New narrative fields:** `sections.sector` and `sections.spending`,
  each `{ et, en }`. The PDF skips a paragraph whose field is missing, so
  an old `narrative.json` still works.
- **Verification:** generate the PDF from a local build via Playwright
  (click the button and capture the download), render its pages to images
  and review them. Unit-test the extracted table builder and the PDF data
  props (e.g. the column set, partial-year flags, and that RevPAR = occ ×
  price).
