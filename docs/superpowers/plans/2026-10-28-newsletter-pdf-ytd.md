# Newsletter PDF: year-to-date focus, operator tables and charts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The downloadable newsletter PDF leads with year-to-date results and
carries the Operator page's tables and charts, drawn natively. The page-1
residents-vs-foreign chart is removed. Short paragraphs on the sector's
turnover and on trip spending are added.

**Architecture:**
- The Operator page's table and chart computations move into a shared
  prototype module.
- `Reports.jsx` uses that module to build a plain-data `pdfData` object and
  passes it to the old-tree `NewsletterPdfButton`, which only draws (jsPDF
  tables and charts; no DOM screenshots).
- `generate-narrative.mjs` gets year-to-date figures (guests, nights,
  domestic, foreign) for Estonia and every region, YTD-first prompt rules,
  and a new `sector` section fed by TU410.

**Tech Stack:** React 18 + Vite (prototype), jsPDF, Node 20 script with
`@anthropic-ai/sdk`, vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-newsletter-pdf-ytd-design.md`

## Global Constraints

- **One computation:** PDF numbers come from the same functions as the
  Operator page; no duplicated formulas.
- **Partial year:** marked with `*` in table headers and drawn
  lightened/hatched in charts.
- **Table type size:** at least 7pt. If the national table doesn't fit,
  drop the earliest full year.
- **Guest type:** all guests (`WORLD`) only.
- **County table:** origin rows trimmed to the top 3.
- **County charts:** last 10 years.
- **Growth chart:** last 36 quarters.
- **RevPAR:** stays (the owner ruled the price is per room). Add a dated
  note to `docs/report-pipeline-changes.md`.
- **Narrative compatibility:**
  - `narrative.json` stays backward compatible: `sections.dashboard` and
    `sections.dashboardByRegion` keep `{et, en}`.
  - New field: `sections.sector` with `{et, en, highlightEt, highlightEn}`.
  - The PDF skips a missing paragraph.
- **Trip-spending paragraph:** reuses the existing `sections.expenses`
  highlight (`highlightEt` / `highlightEn`). No new section.
  - Spec deviation (ruled at planning): the spec named a new
    `sections.spending`.
  - The generator already writes a TU552 trip-spending section with a
    one-sentence highlight, which matches the owner's "short comment".
- **Languages:** both `et` and `en` work. PDF strings go in `src/i18n/et.js`
  and `en.js` (`newsletterPdf.*`); row and chart labels come from the
  prototype's `operatorPage.*` / `sectorPage.*` strings, via props.
- **Source footer:** names TU131, TU122, TU410 and TU552.
- **Commits:** on branch `newsletter-pdf-ytd`, ending with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Regions with sparse data** (small counties or cities with suppressed
   months or missing occupancy):
   - table cells show "—", and nothing crashes or prints `NaN`
   - charts skip null bars and points
2. **Locale `en`:** month column headers ("August 2026"), number formats
   ("3.7M", "€49.67") and the year-to-date label all come out in English.
3. **Latest month is January or December:**
   - January: year-to-date equals the single month.
   - December: no partial year; the table's month columns still work.
4. **Narrative from before this change** (no `sections.sector`): the PDF
   still builds and simply omits the paragraph.
5. **Page 2 county differs from the on-screen selection** (featured
   county): every number on page 2 is that county's, never the selected
   region's.

---

## File Structure

| File | Responsibility |
|---|---|
| `prototype/src/data/operatorTable.js` (new) | `buildColumns` and helpers moved from `Operator.jsx`, plus `shareChartSeries`, `occupancyChartSeries`, `originsByColumn`. |
| `prototype/src/data/operatorTable.test.js` (new) | Tests for the above. |
| `prototype/src/pages/Operator.jsx` | Imports from `operatorTable.js`; no behaviour change. |
| `prototype/src/data/newsletterPdfData.js` (new) | `buildNewsletterPdfData(...)` → plain `pdfData` (tables as label/cell strings, chart series as numbers). |
| `prototype/src/data/newsletterPdfData.test.js` (new) | Tests. |
| `prototype/src/pages/Reports.jsx` | Loads the datasets and passes `pdfData` to `NewsletterPdfButton`. |
| `src/components/pdfDraw.js` (new) | Pure jsPDF drawing: `drawTable`, `drawBarLineChart`, `drawSignedBarChart`, `fitColumns`. |
| `src/components/pdfDraw.test.js` (new) | Tests for `fitColumns` and the scale helpers. |
| `src/components/NewsletterPdfButton.jsx` | New page layout. Removes `nationalResidencyChart` and `captureOperatorSnapshots`; reads `pdfData`. |
| `src/i18n/et.js`, `src/i18n/en.js` | New `newsletterPdf.*` headings. |
| `scripts/narrativeYtd.mjs` (new) | Pure `ytdFigures(byPeriod, periods, latest)` and `sectorFigures(tu410Rows)`. |
| `scripts/narrativeYtd.test.mjs` (new) | Tests. |
| `scripts/generate-narrative.mjs` | Uses the above; YTD-first prompts; new `sector` section; fetches TU410. |
| `docs/report-pipeline-changes.md` | Dated note: RevPAR reinstated in the PDF on the owner's per-room ruling. |

---

### Task 1: Shared Operator table and chart data

**Files:**
- Create: `prototype/src/data/operatorTable.js`,
  `prototype/src/data/operatorTable.test.js`
- Modify: `prototype/src/pages/Operator.jsx`. Formatting helpers such as
  `fmtTableNum` stay in the page. Move out lines 38–209:
  - `monthColLabel`, `yearIndexes`, `yearsIn`, `sumYear`, `likeForLike`,
    `lastInYear`, `meanInYear`, `ytdThrough`, `rankOrigins`,
    `buildColumns`, `chartYears`
  - plus the chart-series code inside `RegionBlock` (lines ~312–390)

**Interfaces:**
- Produces:
  - `buildColumns({ tourism, capacity, code, res, latest, locale }) → Column[]`.
    The shape is unchanged: `key`, `label`, `kind`, `year`, `accommodated`,
    `accommodatedYoy`, `cumulative`, `cumulativeYoy`, `share`,
    `domesticShare`, `esta`, `rooms`, `occ`, `arr`, `arrYoy`, `revpar`.
  - `regionTableColumns(columns, fullYears = 3) → Column[]`: the last
    `fullYears` year columns plus all month columns. This matches the
    page's region table.
  - `shareChartSeries({ tourism, code, years }) → { years, partial: boolean[], national: (number|null)[], sharePct: (number|null)[] }`
  - `occupancyChartSeries({ capacity, code, years }) → { years, partial, occ, revpar, arr }`
  - `originsByColumn(origins, columns, locale, limit) → Map<colKey, {label, value}[]>`:
    what the page builds for `originsByKey`.
  - `chartYears(tourism, n) → number[]`

- [ ] **Step 1: Write failing tests.** Use synthetic `tourism`/`capacity`
  fixtures (as in `askPacket.test.js`) with periods 2017M01–2026M08 and
  region `EE` plus one county.
  ```js
  test("national columns are full years from 2020 to last year plus the latest month in each of the last three years", ...)
  // keys: ["2020",…,"2025","2024M08","2025M08","2026M08"]
  test("cumulative figures exist only on month columns and equal Jan–month sums", ...)
  test("revpar is occupancy% × average price", ...) // col.revpar === col.occ / 100 * col.arr
  test("regionTableColumns keeps the last 3 full years and the month columns", ...)
  test("shareChartSeries flags the partial current year and gives the county's % of Estonia", ...)
  test("occupancyChartSeries yields null (not 0) where occupancy or price is missing", ...)
  ```
- [ ] **Step 2:** Run `npx vitest run prototype/src/data/operatorTable.test.js`.
  Expected: FAIL (module not found).
- [ ] **Step 3:** Move the functions into `operatorTable.js`. Add the three
  series builders, using the same arithmetic the page's `RegionBlock`
  charts use today. Point `Operator.jsx` at the new imports.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 5: Screenshot check.**
  - Run `node prototype/scripts/shoot.mjs /majutusettevotja 1440`
    against the dev server, before and after the move.
  - Expected: the national and region tables and both charts look
    identical.
- [ ] **Step 6:** Commit:
  `git commit -m "Move Operator table and chart data into a shared module"`

### Task 2: Plain-data PDF payload

**Files:**
- Create: `prototype/src/data/newsletterPdfData.js`,
  `prototype/src/data/newsletterPdfData.test.js`
- Modify: `prototype/src/pages/Reports.jsx` (lines 85–99)

**Interfaces:**
- Consumes: Task 1's exports; `useTourism`, `useCapacity`, `useSector`,
  `useOrigins` from `datasets.js`; `fmt*` from `prototype/src/lib/format.js`.
- Produces:
  `buildNewsletterPdfData({ tourism, capacity, sector, originsFor, regionCode, locale, t }) → PdfData`

  ```js
  PdfData = {
    national: { title, columns: string[], rows: { label, cells: string[], sub: boolean }[] },
    region:   { code, title, columns, rows,                       // incl. share + top-3 origin rows
                shareChart: { title, subtitle, years, partial, bars, line, barLabel, lineLabel },
                occChart:   { title, subtitle, years, partial, bars, lines: [{label, values}], } },
    growth:   { title, subtitle, periods: string[], labels: string[], values: number[] },
  }
  ```
  - Cells are already-formatted strings ("3,7 milj.", "+5,4%", "49,67 €",
    "—").
  - Each delta row's cell carries a sign for colouring:
    `{ text, sign: 1 | -1 | 0 | null }`.
- `Reports.jsx`:
  - Computes `pdfData` once the datasets have loaded, for
    `regionCode = isExplicitRegion ? selected : narrative.featuredRegionCode`.
    Read `featuredRegionCode` from `useNarrative().data`. With no explicit
    region on the Reports page, use the region selected in the prototype
    (`useApp().region`) when it isn't Estonia, otherwise the featured
    county. This mirrors today's `RegionContext` rule.
  - Calls `useOrigins(regionCode)` for that county.
  - Passes `<NewsletterPdfButton pdfData={pdfData} regionCode={regionCode} />`.

- [ ] **Step 1: Write failing tests.**
  ```js
  test("national table rows match the Operator page rows in order", ...)
  // labels in order: accommodated, change, cumulative, change, domestic share, establishments, rooms, occupancy, avg price, change, RevPAR
  test("region table adds the share row and exactly 3 origin rows", ...)
  test("missing values render as an em dash, never 'NaN' or 'null'", ...)
  test("delta cells carry sign for colouring", ...)
  test("en locale gives English month headers and number formats", ...)
  test("growth series is the last 36 quarters", ...)
  ```
- [ ] **Step 2:** Run the test file. Expected: FAIL.
- [ ] **Step 3:** Implement `newsletterPdfData.js` and wire it into
  `Reports.jsx`.
- [ ] **Step 4:** Run `npx vitest run`. Expected: all pass. Then run
  `node prototype/scripts/check-i18n.mjs`. Expected: 0 missing.
- [ ] **Step 5:** Commit:
  `git commit -m "Build the newsletter PDF's tables and charts as plain data"`

### Task 3: Native PDF drawing and the new layout

**Files:**
- Create: `src/components/pdfDraw.js`, `src/components/pdfDraw.test.js`
- Modify:
  - `src/components/NewsletterPdfButton.jsx`
  - `src/i18n/et.js`, `src/i18n/en.js` (`newsletterPdf` block)

**Interfaces:**
- Consumes: `PdfData` (Task 2).
- Produces, in `pdfDraw.js`:
  - `fitColumns(labelWidth, cellWidths: number[], available: number) → { widths: number[], dropFirst: number }`
    Fits the table to the width at ≥7pt; drops the earliest columns when
    it can't fit.
  - `drawTable(doc, { x, y, width, columns, rows, fontSize }) → nextY`
  - `drawBarLineChart(doc, { x, y, width, height, chart }) → nextY`.
    Bars, plus one or two lines on a second axis; partial bars lightened
    and hatched; legend.
  - `drawSignedBarChart(doc, { x, y, width, height, chart }) → nextY`.
    Green or red by sign, a zero line, a year tick at each Q1.
  - `niceScale(min, max, ticks) → { min, max, step }`

- [ ] **Step 1: Write failing tests** for the pure parts:
  ```js
  test("fitColumns keeps all columns when they fit", ...)
  test("fitColumns drops the earliest columns rather than going below the minimum width", ...)
  test("niceScale spans negative and positive values with zero on a tick", ...)
  ```
- [ ] **Step 2:** Run `npx vitest run src/components/pdfDraw.test.js`.
  Expected: FAIL.
- [ ] **Step 3:** Implement `pdfDraw.js`.
- [ ] **Step 4:** Rewrite the page layout in `NewsletterPdfButton.jsx`:
  - **Page 1:**
    1. brand/period
    2. headline
    3. intro
    4. KPI tiles
    5. key insights
    6. "Eesti" heading + `sections.dashboard`
    7. `drawTable(national)`
    8. the "Majutussektori majandus" heading + `sections.sector[locale]`
       (if present) + `drawSignedBarChart(growth)`
    9. the "Reisikulud" heading + `sections.expenses.highlight{Et,En}`
       (if present)
  - **Page 2:**
    1. county title
    2. `dashboardByRegion` text
    3. lean KPI table (unchanged)
    4. `drawBarLineChart(shareChart)`
    5. `drawBarLineChart(occChart)`
    6. `drawTable(region)`
  - Delete `nationalResidencyChart` and `captureOperatorSnapshots`, and the
    `html2canvas` import if nothing else uses it. Check with grep before
    removing the dependency; keep it in `package.json` if anything else
    imports it.
  - The source footer lists TU131, TU122, TU410 and TU552.
  - Add the new `newsletterPdf.*` heading strings in both locales.
- [ ] **Step 5:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 6: Generate and review the real PDF.**
  - Playwright clicks the download button on `/aruanded` and `/en/reports`
    of the dev server, and saves the download.
  - Render each page to PNG with pdf.js (`pdfjs-dist` installed in the
    session scratchpad, not the repo).
  - Read the images. Expected:
    - page 1 has no residents/foreign chart
    - the full national table is legible
    - the growth chart is green and red
    - page 2 has both charts and the full county table
    - no "NaN", "null" or "undefined" anywhere
  - Also run with region `?r=hiiu` (sparse county) and with locale `en`.
- [ ] **Step 7:** Commit:
  `git commit -m "Draw the newsletter PDF's tables and charts natively; drop the residency chart"`

### Task 4: Year-to-date and sector text in the narrative generator

**Files:**
- Create: `scripts/narrativeYtd.mjs`, `scripts/narrativeYtd.test.mjs`
- Modify: `scripts/generate-narrative.mjs`:
  - `computeDashboardMetrics` (~82–189)
  - `buildDashboardPrompt` / `buildRegionDashboardPrompt` (~197–229)
  - the `callClaude` system prompt and tool schema (~684–806)
  - `callClaudeRegions` system prompt (~820–947)
  - `main` (~1029+)

**Interfaces:**
- Produces, in `narrativeYtd.mjs`:
  - `ytdFigures(byPeriod: Map<period, row>, periods: string[], latest: string) → { months, guests, guestsYoyPct, nights, nightsYoyPct, domestic, domesticYoyPct, foreign, foreignYoyPct }`.
    `row` has `OCC_ARR_WORLD`, `OCC_NI_WORLD`, `OCC_ARR_EE`,
    `OCC_ARR_FOR`. Missing values count as missing: return null rather
    than summing zeros, if any month is absent.
  - `sectorFigures(tu410Rows) → { latestQuarter, turnoverMeur, yoyPct, lastFour: {period, pct}[] }`,
    using `computeRevenueGrowth` from `src/lib/accommodationSector.js`.
- In `generate-narrative.mjs`:
  - Every region's metrics gain `ytd` (from `ytdFigures`). The national
    and region prompts list the YTD lines **first**, labelled
    `cumulativeRangeLabel(period)`.
  - System prompt rule, replacing the current "must also report the
    cumulative figure" sentence: "The dashboard blurb and every region
    blurb must lead with the year-to-date period (Jan–latest month):
    guests, nights, and domestic vs foreign, each with its change vs the
    same months last year; the latest single month comes after, briefly."
    Add the same rule to `callClaudeRegions`.
  - New `sector` prompt block from `sectorFigures`: the latest quarter's
    turnover in M€ and its YoY %, plus the last four quarters' YoY %.
    The new tool-schema property is `sector: sectorSchema(…, { highlight: true })`.
  - `main` fetches TU410 using the same query object as `useSector` /
    `accommodationSector.js`. The output includes `sections.sector`.
  - The QA gate must not reject the new section. Check `qa` rules.

- [ ] **Step 1: Write failing tests:**
  ```js
  test("ytdFigures sums Jan through the latest month and compares with the same months last year", ...)
  test("ytdFigures returns null for a figure when a month is missing", ...)
  test("ytdFigures handles January (one month)", ...)
  test("sectorFigures gives the latest quarter's turnover and YoY from TU410 rows", ...)
  ```
- [ ] **Step 2:** Run `npx vitest run scripts/narrativeYtd.test.mjs`.
  Expected: FAIL.
- [ ] **Step 3:** Implement `narrativeYtd.mjs`.
- [ ] **Step 4:** Wire it into `generate-narrative.mjs` as above.
- [ ] **Step 5: Dry check without calling Claude.**
  - Run `node -e` to import `narrativeYtd.mjs` and print `ytdFigures` /
    `sectorFigures` from live PxWeb data (no Anthropic call), to confirm
    the numbers match the Operator table's cumulative row for Estonia and
    one county.
  - Run `node --check scripts/generate-narrative.mjs`.
- [ ] **Step 6:** Run `npx vitest run`. Expected: all pass.
- [ ] **Step 7:** Commit:
  `git commit -m "Lead the narrative with year-to-date figures and add a sector turnover section"`

### Task 5: Docs note, end-to-end check, handoff

- [ ] **Step 1:** Add a dated note to `docs/report-pipeline-changes.md`
  under the RevPAR update: on 2026-10-28 the owner ruled
  `OCC_NI_COST` is per room, so RevPAR is reinstated in the PDF tables.
- [ ] **Step 2:** Run `npm test`, `npm run build`,
  `node prototype/scripts/check-i18n.mjs` and `node scripts/prerender.mjs`.
  Expected: all pass.
- [ ] **Step 3:** Regenerate the final PDFs (et, en, featured county, `hiiu`)
  and hand the page images to the owner.
- [ ] **Step 4:** Commit. After the merge (owner's call):
  `gh workflow run "Generate narrative" -f force=true -f dry_run=true`.
  This regenerates the text, and `dry_run` creates the Mailchimp
  campaigns without sending them.
  - Check that the workflow's `dry_run` input applies only to the
    newsletter step. If it doesn't, ask the owner before running, because
    a real run sends the email newsletter.
