# Accommodation Sector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Accommodation Sector" / "Majutussektor" homepage section showing national-level revenue, business counts, YoY growth, wages, and cost structure for Estonia's accommodation industry, sourced live from 3 verified Statistikaamet tables.

**Architecture:** A pure computation module (`src/lib/accommodationSector.js`) parses raw PxWeb rows into chart-ready series and builds deterministic insight sentences; a new page component (`src/components/Page7AccommodationSector.jsx`) fetches the 3 tables client-side (same pattern as every existing page component) and renders the KPI row + 5 modules; `src/App.jsx` gets one new rail entry between Capacity and Expenses. No backend/pipeline changes — this ships entirely in the frontend, independent of the AI narrative pipeline.

**Tech Stack:** React 18, Recharts, the existing `src/api/pxweb.js` client, Vitest (new — added in Task 1) for the pure computation module's unit tests.

**Spec:** `docs/superpowers/specs/2026-10-22-accommodation-sector-design.md`

## Global Constraints

- No region selector, and no regional data, anywhere in this section — verified against the live API that no Statistikaamet table crosses county/city-level region with EMTAK division 55 (accommodation) for any of revenue, enterprise counts, or wages. A single note states this once.
- All 3 source tables are confirmed still on EMTAK 2008 classification (no 2008/2025 split to handle).
- Every query goes through the existing `fetchTableData(pathSegments, tableId, query, { locale, signal })` from `src/api/pxweb.js` — never a raw `fetch()` — so the existing en-locale top-filter bug workaround applies automatically.
- Row shape from `flattenToRows(data)` (from `src/api/jsonStat.js`) mirrors the PxWeb query's own dimension codes as object keys, plus `.value` and `.<TimeDimension>_label` — e.g. a row from an EM001 query has `row.Näitaja`, `row.Tegevusala`, `row["Tööga hõivatud isikute arv"]`, `row.Vaatlusperiood`, `row.Vaatlusperiood_label`, `row.value`.
- Insight sentences are deterministic (computed from fetched numbers), never routed through the Claude/narrative pipeline — this section must work correctly with zero dependency on `narrative.json` or an `ANTHROPIC_API_KEY`.
- Reuse existing components exactly as they are: `TableSource` (`{ path, ids }` props), `ChartTooltip`, `formatNumber(n, locale, options)` from `src/i18n/format.js`, `useAbortableEffect`, `CHART_COLORS` / `CHART_GRID_COLOR` / `CHART_AXIS_COLOR` from `src/theme.js`.

## Review Focus

- **Latest period not yet published** (e.g. TU410's newest quarter is missing, or EM001's newest year lags) — the KPI row and charts must use the latest period actually present in the response, not assume "now," and never show `undefined`/`NaN`. Covered by Task 3's `computeLatestKpis` test.
- **Cost-structure total missing for the requested year** — `computeCostStructure` must return `null` rather than fabricate a total or silently divide by a missing value. Covered by Task 1's cost-structure test.
- **A hotels-vs-other sub-category absent for a given year** (e.g. `I553` camping has no rows that year) — must be treated as 0, not `NaN`, so the "other" sum stays a real number. Covered by Task 1's hotels-split test.
- **Wage comparison period mismatch** between the `I55` and `TOTAL` series (one published before the other) — must inner-join and drop the unmatched period, never show one series with a gap or a fabricated value for the other. Covered by Task 2's wage-comparison test.
- **A growth window with no decline (or no increase) in it** — `computeGrowthHighlights` must return `null` for the missing side rather than mislabeling a weak value, since the spec requires "the largest *significant*" mover, not just the extreme of whatever sign happens to exist. Covered by Task 2's growth-highlights test.

---

### Task 1: Vitest setup + EM001-derived computation functions

**Files:**
- Modify: `package.json` (add `vitest` devDependency, add `"test": "vitest run"` script)
- Create: `src/lib/accommodationSector.js`
- Test: `src/lib/accommodationSector.test.js`

**Interfaces:**
- Produces: `computeRevenueSeries(em001Rows) -> [{ year: string, value: number }]` (ascending by year; `value` in thousand euros, EM001's native unit — callers convert for display)
- Produces: `computeIndexedSeries(series, baseYear) -> [{ year: string, value: number, index: number|null }]`
- Produces: `computeEnterpriseCounts(em001Rows) -> [{ year: string, count: number }]` (ascending)
- Produces: `computeHotelsVsOther(em001Rows) -> [{ year: string, hotels: number, other: number }]` (ascending)
- Produces: `computeCostStructure(em001Rows, year) -> { personnel: number, resale: number, materials: number, energy: number, rent: number, other: number, total: number } | null`
- Consumes: nothing (first task)

- [ ] **Step 1: Add vitest**

```bash
npm install -D vitest
```

Add to `package.json`'s `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing tests**

```javascript
// src/lib/accommodationSector.test.js
import { describe, it, expect } from "vitest";
import {
  computeRevenueSeries,
  computeIndexedSeries,
  computeEnterpriseCounts,
  computeHotelsVsOther,
  computeCostStructure,
} from "./accommodationSector.js";

const EMP_TOTAL = "Tööga hõivatud isikute arv";

function row(Näitaja, Tegevusala, Vaatlusperiood, value, label) {
  return { Näitaja, Tegevusala, [EMP_TOTAL]: "TOTAL", Vaatlusperiood, Vaatlusperiood_label: label ?? Vaatlusperiood, value };
}

describe("computeRevenueSeries", () => {
  it("filters to V12110 at I55 and sorts ascending by year", () => {
    const rows = [
      row("V12110", "I55", "2024", 450000),
      row("V12110", "I55", "2005", 120000),
      row("V12110", "I55", "2010", 200000),
      row("V11110", "I55", "2024", 900), // wrong Näitaja, must be excluded
      row("V12110", "I551", "2024", 300000), // wrong Tegevusala, must be excluded
    ];
    expect(computeRevenueSeries(rows)).toEqual([
      { year: "2005", value: 120000 },
      { year: "2010", value: 200000 },
      { year: "2024", value: 450000 },
    ]);
  });
});

describe("computeIndexedSeries", () => {
  it("indexes every point to the base year's value = 100", () => {
    const series = [{ year: "2010", value: 200 }, { year: "2011", value: 250 }, { year: "2012", value: 300 }];
    expect(computeIndexedSeries(series, "2011")).toEqual([
      { year: "2010", value: 200, index: 80 },
      { year: "2011", value: 250, index: 100 },
      { year: "2012", value: 300, index: 120 },
    ]);
  });

  it("returns null index for every point when the base year is absent", () => {
    const series = [{ year: "2010", value: 200 }];
    expect(computeIndexedSeries(series, "2011")).toEqual([{ year: "2010", value: 200, index: null }]);
  });
});

describe("computeEnterpriseCounts", () => {
  it("filters to V11110 at I55", () => {
    const rows = [row("V11110", "I55", "2024", 937), row("V12110", "I55", "2024", 450000)];
    expect(computeEnterpriseCounts(rows)).toEqual([{ year: "2024", count: 937 }]);
  });
});

describe("computeHotelsVsOther", () => {
  it("sums I552+I553+I559 into other, keeps I551 as hotels", () => {
    const rows = [
      row("V11110", "I551", "2024", 300),
      row("V11110", "I552", "2024", 200),
      row("V11110", "I553", "2024", 50),
      row("V11110", "I559", "2024", 387),
    ];
    expect(computeHotelsVsOther(rows)).toEqual([{ year: "2024", hotels: 300, other: 637 }]);
  });

  it("treats a missing sub-category as 0, not NaN", () => {
    const rows = [row("V11110", "I551", "2024", 300), row("V11110", "I552", "2024", 200)];
    // I553 and I559 absent entirely for 2024
    expect(computeHotelsVsOther(rows)).toEqual([{ year: "2024", hotels: 300, other: 200 }]);
  });
});

describe("computeCostStructure", () => {
  it("computes 'other' as the verified remainder against the real total", () => {
    const rows = [
      row("V13310", "I55", "2024", 100),
      row("CUB_C_100_110_120", "I55", "2024", 50),
      row("CUB_C_210", "I55", "2024", 30),
      row("CUB_C_400_410_420", "I55", "2024", 20),
      row("V13411", "I55", "2024", 10),
      row("CUB_C_705", "I55", "2024", 260),
    ];
    expect(computeCostStructure(rows, "2024")).toEqual({
      personnel: 100,
      resale: 50,
      materials: 30,
      energy: 20,
      rent: 10,
      other: 50, // 260 - (100+50+30+20+10)
      total: 260,
    });
  });

  it("returns null when the total (CUB_C_705) is missing for that year", () => {
    const rows = [row("V13310", "I55", "2024", 100)];
    expect(computeCostStructure(rows, "2024")).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with "accommodationSector.js" not found / functions not exported.

- [ ] **Step 4: Implement the 5 functions in `src/lib/accommodationSector.js`**

Filtering/sorting is straightforward from the test cases above. `computeCostStructure` must look up `CUB_C_705` for the given year first and return `null` immediately if that row is absent — never compute `other` from a missing total. `computeIndexedSeries` must not throw when the base year is absent; every `index` is `null` in that case.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all tests in `accommodationSector.test.js`)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/accommodationSector.js src/lib/accommodationSector.test.js
git commit -m "feat: add vitest and EM001-derived accommodation-sector computations"
```

---

### Task 2: TU410-derived and PA113-derived computation functions

**Files:**
- Modify: `src/lib/accommodationSector.js`
- Modify: `src/lib/accommodationSector.test.js`

**Interfaces:**
- Consumes: nothing from Task 1 (independent data sources)
- Produces: `computeLatestRevenue(tu410Rows) -> { period: string, label: string, valueMillionEur: number } | null`
- Produces: `computeRevenueGrowth(tu410Rows) -> [{ period: string, label: string, pct: number }]` (ascending by period)
- Produces: `computeGrowthHighlights(growthSeries, { windowSize = 16, minSignificantPct = 2 } = {}) -> { latest: {period,label,pct}|null, strongestIncrease: {period,label,pct}|null, strongestDecline: {period,label,pct}|null }` — `strongestIncrease`/`strongestDecline` are `null` whenever the window's actual max/min doesn't clear `minSignificantPct` in magnitude, not just when no value of that sign exists at all (`latest` has no such floor — it's always whatever the most recent quarter actually was, significant or not)
- Produces: `computeWageComparison(pa113Rows) -> [{ period: string, label: string, accommodation: number, allActivities: number }]` (ascending, inner-joined on period)

- [ ] **Step 1: Write the failing tests**

```javascript
function tu410Row(Näitaja, period, value, label) {
  return { Näitaja, "Teenuse liik": "I55", Vaatlusperiood: period, Vaatlusperiood_label: label ?? period, value };
}
function pa113Row(Näitaja, Tegevusala, period, value, label) {
  return { Näitaja, Tegevusala, Vaatlusperiood: period, Vaatlusperiood_label: label ?? period, value };
}

describe("computeLatestRevenue", () => {
  it("returns the single most recent CUB_SERV point", () => {
    const rows = [tu410Row("CUB_SERV", "2026Q1", 45.2), tu410Row("CUB_SERV", "2026Q2", 48.1), tu410Row("CUB_SM", "2026Q2", 6.8)];
    expect(computeLatestRevenue(rows)).toEqual({ period: "2026Q2", label: "2026Q2", valueMillionEur: 48.1 });
  });

  it("returns null when there are no CUB_SERV rows", () => {
    expect(computeLatestRevenue([tu410Row("CUB_SM", "2026Q2", 6.8)])).toBeNull();
  });
});

describe("computeRevenueGrowth", () => {
  it("filters to CUB_SM and sorts ascending by period", () => {
    const rows = [tu410Row("CUB_SM", "2026Q2", 6.8), tu410Row("CUB_SM", "2025Q4", -2.1), tu410Row("CUB_SERV", "2026Q2", 48.1)];
    expect(computeRevenueGrowth(rows)).toEqual([
      { period: "2025Q4", label: "2025Q4", pct: -2.1 },
      { period: "2026Q2", label: "2026Q2", pct: 6.8 },
    ]);
  });
});

describe("computeGrowthHighlights", () => {
  it("picks the latest point, the max positive, and the min negative in the window", () => {
    const series = [
      { period: "2025Q1", label: "2025Q1", pct: 2 },
      { period: "2025Q2", label: "2025Q2", pct: 9.4 },
      { period: "2025Q3", label: "2025Q3", pct: -3.2 },
      { period: "2025Q4", label: "2025Q4", pct: 1 },
    ];
    expect(computeGrowthHighlights(series)).toEqual({
      latest: { period: "2025Q4", label: "2025Q4", pct: 1 },
      strongestIncrease: { period: "2025Q2", label: "2025Q2", pct: 9.4 },
      strongestDecline: { period: "2025Q3", label: "2025Q3", pct: -3.2 },
    });
  });

  it("returns null for strongestDecline when every value in the window is positive", () => {
    const series = [{ period: "2025Q1", label: "2025Q1", pct: 2 }, { period: "2025Q2", label: "2025Q2", pct: 5 }];
    const result = computeGrowthHighlights(series);
    expect(result.strongestDecline).toBeNull();
    expect(result.strongestIncrease).toEqual({ period: "2025Q2", label: "2025Q2", pct: 5 });
  });

  it("returns null for a mover whose magnitude doesn't clear minSignificantPct, even though it's the window's extreme", () => {
    const series = [{ period: "2025Q1", label: "2025Q1", pct: 0.3 }, { period: "2025Q2", label: "2025Q2", pct: -0.1 }];
    const result = computeGrowthHighlights(series, { minSignificantPct: 2 });
    expect(result.strongestIncrease).toBeNull();
    expect(result.strongestDecline).toBeNull();
    expect(result.latest).toEqual({ period: "2025Q2", label: "2025Q2", pct: -0.1 }); // latest has no significance floor
  });

  it("only considers the last windowSize entries", () => {
    const series = Array.from({ length: 20 }, (_, i) => ({ period: `P${i}`, label: `P${i}`, pct: i === 0 ? 99 : 1 }));
    const result = computeGrowthHighlights(series, { windowSize: 16 });
    expect(result.strongestIncrease.period).not.toBe("P0"); // P0 fell outside the last-16 window
  });
});

describe("computeWageComparison", () => {
  it("inner-joins I55 and TOTAL rows on matching period", () => {
    const rows = [
      pa113Row("GR_W_AVG", "I55", "2026Q1", 1450),
      pa113Row("GR_W_AVG", "TOTAL", "2026Q1", 2100),
      pa113Row("GR_W_AVG", "I55", "2026Q2", 1500),
      pa113Row("GR_W_AVG", "TOTAL", "2026Q2", 2150),
      pa113Row("GR_W_AVG_SM", "I55", "2026Q2", 5.1), // wrong Näitaja, excluded
    ];
    expect(computeWageComparison(rows)).toEqual([
      { period: "2026Q1", label: "2026Q1", accommodation: 1450, allActivities: 2100 },
      { period: "2026Q2", label: "2026Q2", accommodation: 1500, allActivities: 2150 },
    ]);
  });

  it("drops a period present for only one side", () => {
    const rows = [
      pa113Row("GR_W_AVG", "I55", "2026Q1", 1450),
      pa113Row("GR_W_AVG", "TOTAL", "2026Q1", 2100),
      pa113Row("GR_W_AVG", "I55", "2026Q2", 1500), // TOTAL for 2026Q2 not yet published
    ];
    expect(computeWageComparison(rows)).toEqual([{ period: "2026Q1", label: "2026Q1", accommodation: 1450, allActivities: 2100 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL (new functions not exported yet)

- [ ] **Step 3: Implement the 4 functions in `src/lib/accommodationSector.js`**

`computeGrowthHighlights` takes `series.slice(-windowSize)` first, then: `latest` = the window's last entry (or `null` if empty, no significance floor applied); `strongestIncrease` = the max-`pct` entry among those with `pct >= minSignificantPct` (or `null` if none clear it); `strongestDecline` = the min-`pct` entry among those with `pct <= -minSignificantPct` (or `null` if none clear it). `computeWageComparison` builds a `Map` keyed by period from the `TOTAL` rows, then walks the `I55` rows in period order, including only periods present in that map.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/accommodationSector.js src/lib/accommodationSector.test.js
git commit -m "feat: add TU410 growth and PA113 wage computations"
```

---

### Task 3: KPI aggregation + deterministic insight builders

**Files:**
- Modify: `src/lib/accommodationSector.js`
- Modify: `src/lib/accommodationSector.test.js`

**Interfaces:**
- Consumes: the exact return shapes of `computeLatestRevenue`, `computeGrowthHighlights`, `computeEnterpriseCounts`, `computeWageComparison` from Tasks 1–2
- Produces: `computeLatestKpis({ latestRevenue, growthHighlights, enterpriseCounts, wageComparison }) -> { revenue: {value,period}|null, revenueYoy: {value,period}|null, businessCount: {value,period}|null, avgWage: {value,period}|null }` (each field `null` only if its own source array/object was empty)
- Produces: `buildRevenueInsight(latestRevenue, growthHighlights, locale) -> string | null`
- Produces: `buildGrowthInsight(growthHighlights, locale) -> string | null`
- Produces: `buildBusinessInsight(enterpriseCounts, hotelsVsOther, locale) -> string | null`
- Produces: `buildWageInsight(wageComparison, locale) -> string | null`
- Produces: `buildCostInsight(costStructure, locale) -> string | null`

**Exact sentence templates** (the spec's own style example: "Majutussektori käive kasvas aastaga 6,8%." / numbers formatted via `formatNumber` from `src/i18n/format.js`, percentages to 1 decimal, euros as whole numbers for wages and millions-with-1-decimal for revenue):

- Revenue (et): `` `Majutussektori käive oli ${period} ${value} miljonit eurot, ${yoyPct >= 0 ? "kasvades" : "vähenedes"} aastaga ${abs(yoyPct)}%.` ``
- Revenue (en): `` `Accommodation-sector revenue was €${value} million in ${period}, ${yoyPct >= 0 ? "up" : "down"} ${abs(yoyPct)}% year-over-year.` ``
- Growth (et): `` `Majutussektori käive ${latest.pct >= 0 ? "kasvas" : "vähenes"} ${latest.period}. kvartalis ${abs(latest.pct)}%.` ``
- Growth (en): `` `Accommodation-sector revenue ${latest.pct >= 0 ? "grew" : "fell"} ${abs(latest.pct)}% in ${latest.period}.` ``
- Business (et): `` `Eestis tegutses ${year} aastal ${count} majutusettevõtet, neist ${hotelsPct}% hotellid.` ``
- Business (en): `` `Estonia had ${count} accommodation businesses in ${year}, ${hotelsPct}% of them hotels.` `` (`hotelsPct = round(hotels / (hotels+other) * 100)` from the latest `hotelsVsOther` entry matching `enterpriseCounts`' latest year)
- Wage (et): `` `Majutussektori keskmine brutopalk oli ${period} ${accommodation} eurot, Eesti keskmine oli ${allActivities} eurot.` ``
- Wage (en): `` `Accommodation-sector average gross wage was €${accommodation} in ${period}, versus Estonia's €${allActivities} average.` ``
- Cost (et): `` `Suurim kulukategooria oli ${largestCategoryLabel} (${largestCategoryPct}% kogukuludest).` `` (largest among the 6 `computeCostStructure` fields by value, as a % of `total`)
- Cost (en): `` `The largest cost category was ${largestCategoryLabel} (${largestCategoryPct}% of total costs).` ``

Category labels for the cost insight come from a small local map (`{ personnel: "personalikulud"/"personnel costs", resale: "edasimüügiks ostetud kaubad"/"goods purchased for resale", materials: "materjalid"/"materials", energy: "energia"/"energy", rent: "rent ja liisingud"/"rent and leasing", other: "muud tegevuskulud"/"other operating costs" }`) — define this map once in `accommodationSector.js` and reuse it from both the insight builder and (in Task 6) the chart's own legend, so the two never drift apart.

- [ ] **Step 1: Write the failing tests**

```javascript
describe("computeLatestKpis", () => {
  it("assembles all 4 KPIs from their own source's latest entry", () => {
    const latestRevenue = { period: "2026Q2", label: "2026Q2", valueMillionEur: 48.1 };
    const growthHighlights = { latest: { period: "2026Q2", label: "2026Q2", pct: 6.8 }, strongestIncrease: null, strongestDecline: null };
    const enterpriseCounts = [{ year: "2023", count: 900 }, { year: "2024", count: 937 }];
    const wageComparison = [{ period: "2026Q1", label: "2026Q1", accommodation: 1450, allActivities: 2100 }, { period: "2026Q2", label: "2026Q2", accommodation: 1500, allActivities: 2150 }];
    expect(computeLatestKpis({ latestRevenue, growthHighlights, enterpriseCounts, wageComparison })).toEqual({
      revenue: { value: 48.1, period: "2026Q2" },
      revenueYoy: { value: 6.8, period: "2026Q2" },
      businessCount: { value: 937, period: "2024" },
      avgWage: { value: 1500, period: "2026Q2" },
    });
  });

  it("returns null for a KPI whose own source is empty, without affecting the others", () => {
    const result = computeLatestKpis({ latestRevenue: null, growthHighlights: { latest: null, strongestIncrease: null, strongestDecline: null }, enterpriseCounts: [{ year: "2024", count: 937 }], wageComparison: [] });
    expect(result.revenue).toBeNull();
    expect(result.revenueYoy).toBeNull();
    expect(result.businessCount).toEqual({ value: 937, period: "2024" });
    expect(result.avgWage).toBeNull();
  });
});

describe("insight builders", () => {
  it("buildRevenueInsight phrases an increase in Estonian and English", () => {
    const latestRevenue = { period: "2026Q2", label: "2026Q2", valueMillionEur: 48.1 };
    const growthHighlights = { latest: { period: "2026Q2", label: "2026Q2", pct: 6.8 }, strongestIncrease: null, strongestDecline: null };
    expect(buildRevenueInsight(latestRevenue, growthHighlights, "et")).toContain("kasvades");
    expect(buildRevenueInsight(latestRevenue, growthHighlights, "en")).toContain("up");
  });

  it("buildRevenueInsight returns null when either input is null", () => {
    expect(buildRevenueInsight(null, { latest: null }, "et")).toBeNull();
  });

  it("buildCostInsight names the actual largest category", () => {
    const cost = { personnel: 100, resale: 50, materials: 30, energy: 20, rent: 10, other: 50, total: 260 };
    const insight = buildCostInsight(cost, "en");
    expect(insight).toContain("personnel costs");
    expect(insight).toContain("38%"); // 100/260
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL (functions not exported yet)

- [ ] **Step 3: Implement `computeLatestKpis` and the 5 `build*Insight` functions**

Each `build*Insight` returns `null` immediately if its required input(s) are `null`/empty — never render a sentence with a missing number. Use `formatNumber` for all numeric formatting to match the rest of the site's locale conventions.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/accommodationSector.js src/lib/accommodationSector.test.js
git commit -m "feat: add accommodation-sector KPI aggregation and insight sentences"
```

---

### Task 4: i18n additions

**Files:**
- Modify: `src/i18n/et.js`
- Modify: `src/i18n/en.js`

**Interfaces:**
- Consumes: nothing (static content)
- Produces: `t("nav.accommodationSector")` and the full `t("accommodationSector.*")` namespace Task 5–6 will call

- [ ] **Step 1: Add `nav.accommodationSector` to both locale files**

et.js: `"Majutussektor"`. en.js: `"Accommodation Sector"`. Add alongside the existing `nav.expenses`/`nav.capacity` entries in each file's `nav: {}` block.

- [ ] **Step 2: Add the `accommodationSector` namespace to both locale files**

```javascript
// et.js
accommodationSector: {
  heading: "Majutussektor",
  subheading: "Majutussektori käive, ettevõtted, palgad ja kulud Eestis.",
  nationalOnlyNote: "Sektoriandmed on Statistikaametilt saadaval ainult Eesti kohta.",
  kpi: {
    revenue: "Käive",
    revenueYoy: "Käibe muutus aastaga",
    businesses: "Ettevõtteid",
    avgWage: "Keskmine brutopalk",
  },
  revenueHeading: "Majutussektori müügitulu",
  revenueIndexToggle: "Indekseeritud (2011=100)",
  businessesHeading: "Majutusettevõtted ja käive",
  hotels: "Hotellid",
  otherAccommodation: "Muu majutus",
  growthHeading: "Majutussektori käibe kasv",
  wagesHeading: "Majutussektori palgad",
  wagesAccommodation: "Majutussektor",
  wagesAllActivities: "Eesti keskmine",
  costHeading: "Majutussektori kulude struktuur",
  costCategories: {
    personnel: "Personalikulud",
    resale: "Edasimüügiks ostetud kaubad",
    materials: "Materjalid ja tooted",
    energy: "Energia",
    rent: "Rent ja liising",
    other: "Muud tegevuskulud",
  },
},
```

```javascript
// en.js
accommodationSector: {
  heading: "Accommodation Sector",
  subheading: "Revenue, businesses, wages and costs in Estonia's accommodation sector.",
  nationalOnlyNote: "Sector data is only available nationally.",
  kpi: {
    revenue: "Revenue",
    revenueYoy: "YoY revenue change",
    businesses: "Businesses",
    avgWage: "Average gross wage",
  },
  revenueHeading: "Accommodation Sector Revenue",
  revenueIndexToggle: "Indexed (2011=100)",
  businessesHeading: "Accommodation Businesses and Turnover",
  hotels: "Hotels",
  otherAccommodation: "Other accommodation",
  growthHeading: "Revenue Growth",
  wagesHeading: "Accommodation Sector Wages",
  wagesAccommodation: "Accommodation sector",
  wagesAllActivities: "Estonia average",
  costHeading: "Accommodation Sector Cost Structure",
  costCategories: {
    personnel: "Personnel costs",
    resale: "Goods purchased for resale",
    materials: "Materials and supplies",
    energy: "Energy",
    rent: "Rent and leasing",
    other: "Other operating costs",
  },
},
```

- [ ] **Step 3: Verify the build still passes**

Run: `npm run build`
Expected: builds cleanly (confirms no JSON/JS syntax errors in either locale file)

- [ ] **Step 4: Commit**

```bash
git add src/i18n/et.js src/i18n/en.js
git commit -m "feat: add accommodation-sector i18n strings"
```

---

### Task 5: Page component — data fetching, KPI row, Revenue and Businesses modules

**Files:**
- Create: `src/components/Page7AccommodationSector.jsx`

**Interfaces:**
- Consumes: every function from Tasks 1–3 (`computeRevenueSeries`, `computeIndexedSeries`, `computeEnterpriseCounts`, `computeHotelsVsOther`, `computeCostStructure`, `computeLatestRevenue`, `computeRevenueGrowth`, `computeGrowthHighlights`, `computeWageComparison`, `computeLatestKpis`, `buildRevenueInsight`, `buildGrowthInsight`, `buildBusinessInsight`, `buildWageInsight`, `buildCostInsight`), the `accommodationSector.*` i18n keys from Task 4
- Produces: `export default function Page7AccommodationSector()`, consumed by Task 6 (App.jsx wiring)

**Exact PxWeb queries** (follow `Page6Capacity.jsx`'s existing `fetchTableData`-in-`useAbortableEffect` pattern exactly):

```javascript
const EM001_PATH = ["majandus", "ettevetete-majandusnaitajad", "ettevetete-tulud-kulud-kasum", "aastastatistika"];
const TU410_PATH = ["majandus", "turism-ja-majutus", "turismi-ja-majutuse-majandusnaitajad"];
const PA113_PATH = ["majandus", "palk-ja-toojeukulu", "palk", "luhiajastatistika"];

const em001Query = [
  { code: "Näitaja", selection: { filter: "item", values: ["V12110", "V11110", "CUB_C_705", "V13310", "CUB_C_100_110_120", "CUB_C_210", "CUB_C_400_410_420", "V13411"] } },
  { code: "Tegevusala", selection: { filter: "item", values: ["I55", "I551", "I552", "I553", "I559"] } },
  { code: "Tööga hõivatud isikute arv", selection: { filter: "item", values: ["TOTAL"] } },
  { code: "Vaatlusperiood", selection: { filter: "top", values: ["24"] } }, // EM001 has 20 annual periods; 24 safely covers all of them
];

const tu410Query = [
  { code: "Näitaja", selection: { filter: "item", values: ["CUB_SERV", "CUB_SM"] } },
  { code: "Teenuse liik", selection: { filter: "item", values: ["I55"] } },
  { code: "Vaatlusperiood", selection: { filter: "top", values: ["16"] } }, // last 16 quarters (~4 years) for the growth chart + latest KPI
];

const pa113Query = [
  { code: "Näitaja", selection: { filter: "item", values: ["GR_W_AVG"] } },
  { code: "Tegevusala", selection: { filter: "item", values: ["I55", "TOTAL"] } },
  { code: "Vaatlusperiood", selection: { filter: "top", values: ["24"] } }, // PA113 has 22 quarterly periods; 24 safely covers all of them
];
```

Fetch all 3 in parallel (`Promise.all`) inside one `useAbortableEffect`, same cancellation-on-unmount pattern as `Page6Capacity.jsx`; `flattenToRows()` each response before passing to the Task 1–3 functions.

- [ ] **Step 1: Scaffold the component shell**

`Page7AccommodationSector()`: `useState` for the 3 raw row arrays (`em001Rows`, `tu410Rows`, `pa113Rows`, each starting `null`) and a `loading`/`error` state; `useAbortableEffect` issuing the 3 queries above via `fetchTableData`, storing `flattenToRows()` results. Render nothing but a loading state until all 3 have resolved (matches the rest of the site's graceful-loading convention — check `Page6Capacity.jsx`'s own loading-state handling and mirror it).

- [ ] **Step 2: Render the section header and KPI row**

`<h2>{t("accommodationSector.heading")}</h2>`, the one-sentence `subheading`, the `nationalOnlyNote` (small, muted text — match the styling convention `SourceFooter.jsx`'s `.source-footer-scope` already established for this kind of disclosure line). Compute `computeLatestKpis(...)`'s 4 arguments from these already-computed intermediate results: `latestRevenue = computeLatestRevenue(tu410Rows)`, `growthHighlights = computeGrowthHighlights(computeRevenueGrowth(tu410Rows))`, `enterpriseCounts = computeEnterpriseCounts(em001Rows)`, `wageComparison = computeWageComparison(pa113Rows)`; then render 4 KPI tiles, each showing its own `period` next to the label (e.g. "Käive — 2026 K2"). Reuse this project's existing KPI-tile CSS class/pattern if one already exists on another page (check `Page6Capacity.jsx`/`Dashboard.jsx` for a `.kpi-tile`-equivalent class before inventing a new one).

- [ ] **Step 3: Render Module 1 (Revenue)**

Recharts `LineChart` of `computeRevenueSeries(em001Rows)`, x-axis `year`, y-axis `value` (convert thousand-€ to million-€ for display: `/ 1000`). A toggle (local `useState`) switches to `computeIndexedSeries(series, "2011")`'s `index` field when indexed view is on — render the toggle's label from `t("accommodationSector.revenueIndexToggle")`. Render `buildRevenueInsight(...)` as one short paragraph above or below the chart. `<TableSource path={EM001_PATH} ids={["EM001.PX"]} />` plus an expandable raw-values table (reuse whatever expandable-table pattern another page component already uses, e.g. check `Page5Expenses.jsx` or `Page6Capacity.jsx` for a details/summary or toggle-table pattern — don't invent a new one).

- [ ] **Step 4: Render Module 2 (Businesses and turnover)**

Two adjacent `ResponsiveContainer` charts (per the spec: avoid a dual-axis combo) — a `BarChart` of `computeRevenueSeries` (reused from Module 1, already in scope) and a `LineChart` of `computeEnterpriseCounts(em001Rows)`, sharing the same x-axis year range. Below both, a stacked or grouped `BarChart` of `computeHotelsVsOther(em001Rows)` with `t("accommodationSector.hotels")`/`t("accommodationSector.otherAccommodation")` legend labels, colors from `CHART_COLORS[0]`/`CHART_COLORS[1]` (fixed order, not cycled, per this project's existing categorical-color convention). Render `buildBusinessInsight(enterpriseCounts, hotelsVsOther, locale)`. `<TableSource path={EM001_PATH} ids={["EM001.PX"]} />`.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open the app, confirm the KPI row and Modules 1–2 render with real numbers (no `NaN`/`undefined` visible), in both `et` and `en` locales via the existing locale switcher.

- [ ] **Step 6: Commit**

```bash
git add src/components/Page7AccommodationSector.jsx
git commit -m "feat: add accommodation-sector page component (KPIs, revenue, businesses)"
```

---

### Task 6: Page component — Growth, Wages, Cost structure modules, and App.jsx wiring

**Files:**
- Modify: `src/components/Page7AccommodationSector.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `Page7AccommodationSector` (default export) from Task 5
- Produces: the section is live and reachable in the app

- [ ] **Step 1: Render Module 3 (Growth)**

`BarChart` of `computeRevenueGrowth(tu410Rows)` (already fetched in Task 5), coloring each bar by sign (positive/negative — reuse `POSITIVE_COLOR`/`NEGATIVE_COLOR`-equivalent tokens already established elsewhere in this project, e.g. `--positive`/`--alert` from `src/styles/tokens.css`, the same pair `NewsletterPdfButton.jsx` already uses). Call out `computeGrowthHighlights(...)`'s `latest`/`strongestIncrease`/`strongestDecline` as 3 short labeled lines (or tooltips) above the chart; render `buildGrowthInsight(...)`. `<TableSource path={TU410_PATH} ids={["TU410.PX"]} />`.

- [ ] **Step 2: Render Module 4 (Wages)**

`LineChart` of `computeWageComparison(pa113Rows)`, 2 series (`accommodation`, `allActivities`), with end-of-line value labels using `LineEndLabel`/`lastPointDot` from `src/components/ChartLabels.jsx` (the same house style `Page6Capacity.jsx` already uses), legend labels `t("accommodationSector.wagesAccommodation")`/`t("accommodationSector.wagesAllActivities")`. Render `buildWageInsight(...)`. `<TableSource path={PA113_PATH} ids={["PA113.px"]} />`.

- [ ] **Step 3: Render Module 5 (Cost structure)**

Recharts `PieChart` with `innerRadius` set (a donut, not a plain pie — matches the spec's "compact donut chart" ask) of `computeCostStructure(em001Rows, latestEM001Year)`'s 6 fields (`personnel`, `resale`, `materials`, `energy`, `rent`, `other`), using the `costCategories` i18n labels and `CHART_COLORS[0..5]` in that fixed order. `latestEM001Year` = the last entry's `year` from `computeRevenueSeries(em001Rows)` (already in scope). Render `buildCostInsight(...)`. An expandable detail area (not a second always-visible chart, per the design doc) can show the same categories as a stacked-over-time view if time allows — if it doesn't fit cleanly, ship the donut alone and note the omission in the task's completion report rather than forcing it in. `<TableSource path={EM001_PATH} ids={["EM001.PX"]} />`.

- [ ] **Step 4: Wire into `src/App.jsx`**

Add `{ key: "accommodationSector", label: t("nav.accommodationSector") }` to `RAIL_ITEMS`, between the `capacity` and `expenses` entries. Add the matching scroll-section block (mirror the existing `capacity`/`expenses` blocks' exact JSX shape — `<h2 className="scroll-section-title">{t("nav.accommodationSector")}</h2>` followed by `<Page7AccommodationSector />`), positioned between the existing Capacity and Expenses blocks. Import `Page7AccommodationSector` at the top of `App.jsx` alongside the other `Page*` imports.

- [ ] **Step 5: Manual verification — full section, both locales, mobile width**

Run: `npm run build` (must succeed). Run: `npm run dev`, open the app, scroll through the new section confirming: all 5 modules render with real data and correct source citations; the nav rail entry appears and scrolls to the right place; switching locale updates every label; narrowing the viewport to ~375px keeps the layout single-column with no horizontal overflow (matches `Page6Capacity.jsx`'s existing responsive behavior — don't add a new breakpoint).

- [ ] **Step 6: Commit**

```bash
git add src/components/Page7AccommodationSector.jsx src/App.jsx
git commit -m "feat: add growth/wages/cost-structure modules and wire accommodation sector into nav"
```
