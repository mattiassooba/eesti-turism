# Accommodation Sector ("Majutussektor") Design

## Objective

Add a new homepage section, "Accommodation Sector" / "Majutussektor", showing the economic
performance of Estonia's accommodation industry: revenue, business counts, YoY growth, wages,
and cost structure. Reuses the existing site's design system, chart stack, and data-fetching
pattern — this is a new page component in the existing scroll, not a new app.

## Data-source audit (verified directly against the live PxWeb API)

Every table/path/code below was confirmed by a live metadata GET against
`https://andmed.stat.ee/api/v1/en/stat/...` during this design pass — not assumed from the
spec's candidate list. A prior research pass (an agent dispatch) found the same tables but
summarized some paths and one date range incorrectly; the values below are the corrected,
first-hand-verified ones.

### The central finding: no regional breakdown exists for this section, at all

The spec's Section 3 asks for dynamic region-vs-Estonia comparisons (Tallinn vs Estonia, Harju
vs Estonia, etc.), matching the site's existing region selector. **This is not available for
any of the 5 modules.** Checked directly:

- `EM001`, `EM041` (financial statistics by economic activity), `PA113` (wages by economic
  activity): their only breakdown is by `Tegevusala` (economic activity) — **no regional
  dimension exists in these tables at all.**
- `ER0270`/`ER0271` (enterprises by county) and `EM003` (financial statistics by county): these
  **do** have a county dimension, but their economic-activity breakdown stops at **section**
  level (`I` = "Accommodation and food service activities", which includes restaurants) or is
  absent entirely (`EM003`'s only activity value is `TOTAL_X_K`, all activities). Neither can
  isolate accommodation (`I55`) regionally.
- `PA107`/`PA117`/`PA118`/`PA119` (regional wages): no economic-activity dimension at all.

Per the spec's own rule ("never substitute overall county business turnover for
accommodation-sector turnover," "never display the national value under a regional label"),
none of these can be used to fake a regional view. **Decision (confirmed with the user):** this
section ships Estonia-only, with no region selector. A single line under the section header
states this plainly, once, instead of a per-chart "Estonia only" badge.

### Verified tables

| # | Table | Path (pathSegments array) | Relevant `Näitaja`/indicator codes | `Tegevusala` codes needed | Period dimension | Verified range |
|---|---|---|---|---|---|---|
| 1 | **EM001** — Financial statistics of enterprises by economic activity | `["majandus", "ettevetete-majandusnaitajad", "ettevetete-tulud-kulud-kasum", "aastastatistika"]` | `V12110` Turnover (th. €); `V11110` Number of enterprises; `CUB_C_705` Costs total (th. €); `V13310` Personnel costs; `CUB_C_100_110_120` Goods/services purchased for resale; `CUB_C_210` Materials/supplies/intermediate goods; `CUB_C_400_410_420` Purchased fuel and power; `V13411` Rental/leasing payments | `I55` (all accommodation); `I551` hotels, `I552` holiday/short-stay, `I553` camping, `I559` other (for the hotels-vs-other split) | `Vaatlusperiood`, annual | 2005–2024 (20 periods) |
| 2 | **TU410** — Sale of accommodation/catering/touring services and volume index change | `["majandus", "turism-ja-majutus", "turismi-ja-majutuse-majandusnaitajad"]` | `CUB_SERV` Sale of services (M€); `CUB_SM` YoY volume-index change (%, **pre-computed by Statistikaamet** — use directly, don't re-derive) | `Teenuse liik`: `I55` (Accommodation only — `I56` food/beverage and `N79` travel agencies exist in the same table, must not be included) | `Vaatlusperiood`, quarterly | 2001Q1–2026Q2 (102 periods) |
| 3 | **PA113** — Average monthly gross wages and median by economic activity | `["majandus", "palk-ja-toojeukulu", "palk", "luhiajastatistika"]` | `GR_W_AVG` Average monthly gross wage (€); `GR_W_AVG_SM` YoY % change (**pre-computed**, use directly) | `Tegevusala`: `I55` (accommodation) and `TOTAL` (all activities — the national comparator for Module 4) | `Vaatlusperiood`, quarterly | **2021Q1–2026Q2 (22 periods)** — corrected from the research pass, which incorrectly reported 2001–2026 (that range belongs to TU410, not PA113) |

An important EM001 employment-size dimension, `Tööga hõivatud isikute arv` (number of persons
employed, 7 bucketed values), must be pinned to `TOTAL` on every EM001 query — otherwise rows
split across 7 size classes instead of giving the sector total.

### Cost-structure math (Module 5) — corrected from the research pass

The research pass proposed 6 named cost categories (personnel, resale, materials, energy, rent,
"other costs" = `CUB_C_545` alone) as if they summed to `CUB_C_705` (costs total). **They don't**
— EM001 has at least 7 more cost line items (depreciation, taxes, doubtful accounts, travel
costs, subcontractor payments, agency-worker payments, other laid-out work) that aren't in that
list. Using `CUB_C_545` alone as "Other" would under-report the true residual and the donut
wouldn't sum to 100% of the real total, which fails the spec's own "do not calculate category
percentages unless the relevant categories form a valid, complete total" rule.

**Correct approach:** fetch 6 values (`V13310`, `CUB_C_100_110_120`, `CUB_C_210`,
`CUB_C_400_410_420`, `V13411`, `CUB_C_705`) and compute the donut's 6th slice as a remainder:

```
otherOperatingCosts = CUB_C_705 - (V13310 + CUB_C_100_110_120 + CUB_C_210 + CUB_C_400_410_420 + V13411)
```

This guarantees the 6 slices always sum to exactly the verified total, however many minor line
items the remainder actually contains, and is itself labeled "Other operating costs" (not
"Other costs", which would wrongly imply it's just `CUB_C_545`).

### EMTAK 2008/2025 classification

All three tables (EM001, TU410, PA113) are still on EMTAK 2008 and have not split into a 2025
variant — no classification break to handle for this section. (The break only shows up in the
regional enterprise-count tables, ER0270/ER0271, which aren't used here anyway.)

## Placement

New rail/scroll section, inserted between *Mahutavus* (Capacity) and *Reisikulutused*
(Expenses) in `src/App.jsx`'s `RAIL_ITEMS` array and the corresponding scroll block — capacity
(occupancy/price/beds) leads naturally into sector economics before the page moves to visitor
spending. New nav i18n key `nav.accommodationSector`.

## Component architecture

New file `src/components/Page7AccommodationSector.jsx`, following the exact pattern every
existing page component uses: `fetchTableData` from `src/api/pxweb.js` inside
`useAbortableEffect`, `flattenToRows` from `src/api/jsonStat.js`, Recharts for charts,
`TableSource` for the "Allikas: Statistikaamet, tabel X" citation + expandable raw-data table,
`ChartTooltip` for hover tooltips. No backend/pipeline changes — this is a pure frontend
addition, fetched live client-side exactly like Page6Capacity.jsx already does, so it needs no
new generate-narrative.mjs wiring and works immediately (no dependency on the next scheduled AI
narrative generation).

**Insight text is deterministic, not AI-generated.** Each module's one-sentence insight (e.g.
"Majutussektori käive kasvas aastaga 6,8%.") is computed directly from the fetched numbers in a
small pure helper (`accommodationInsights.js`, co-located with the page component), the same
style as `scripts/lib/findings.mjs` already uses server-side — not routed through the Claude
narrative pipeline. This keeps the section fully correct and testable immediately with live
data, rather than depending on a Claude call this environment currently has no API key to make.

## Modules

### KPI row (4 tiles, each labeled with its own period)

1. Latest quarterly revenue — TU410 `CUB_SERV`, latest period (e.g. "2026 K2")
2. YoY revenue change — TU410 `CUB_SM`, same period (pre-computed, not derived)
3. Number of accommodation businesses — EM001 `V11110`, `I55`, latest annual period (e.g. "2024")
4. Average monthly gross wage — PA113 `GR_W_AVG`, `I55`, latest period (e.g. "2026 K2")

### Module 1 — Revenue (Majutussektori müügitulu)

Line chart, EM001 `V12110` annual turnover 2005–2024 (`I55`), with an indexed-to-2011=100
toggle (base year matches the user's own reference screenshot, Figure 59 — not independently
chosen; EM001's real series goes back to 2005, so the index is computed from the full verified
series with 2011 simply set as the =100 reference point). "Latest revenue"
and "YoY change" KPI values come from TU410 (more current, quarterly) rather than EM001's
year-old annual figure — each value is labeled with its own period so the two frequencies are
never implied to be the same reporting period.

### Module 2 — Businesses and turnover (Majutusettevõtted ja käive)

Two adjacent small charts, not one dual-axis combo (turnover in millions vs. enterprise counts
in the hundreds don't share a sensible scale, and this project's charts avoid dual-axis — see
`dataviz` skill's "never a dual-axis chart" rule, already followed everywhere else on this
site): a turnover bar chart (EM001 `V12110`, annual) and an enterprise-count line chart (EM001
`V11110`, annual), sharing the same year range for easy visual alignment. Plus a hotels-vs-other
split (stacked or grouped bar): hotels = `I551`, other = `I552 + I553 + I559` summed.

### Module 3 — Revenue growth (Majutussektori käibe kasv)

Bar chart of TU410's own pre-computed `CUB_SM` (YoY volume-index change, %) across recent
quarters (last ~12–16). Auto-highlights the latest quarter's value, the largest increase, and
the largest decline in the shown window — same magnitude-based selection approach as
`findings.mjs`, applied to this module's own data instead of a shared cross-module findings list.

### Module 4 — Wages (Majutussektori palgad)

Line chart, 2 series: PA113 `GR_W_AVG` at `I55` (accommodation) vs. `TOTAL` (all economic
activities, Estonia's national average) — confirmed both values exist in the same table, so this
is a same-source, same-methodology comparison, not a cross-table estimate. 2021Q1–2026Q2 (22
quarters — this is a genuinely short series; the chart should not imply a longer history than
the source actually has). End-of-line value labels for both series, consistent with the house
style already used elsewhere (`ChartLabels.jsx`'s `LineEndLabel`).

### Module 5 — Cost structure (Majutussektori kulude struktuur)

Donut chart, latest year (2024), 6 slices: Personnel costs (`V13310`), Goods/services purchased
for resale (`CUB_C_100_110_120`), Materials and supplies (`CUB_C_210`), Purchased fuel and power
— "Energy" (`CUB_C_400_410_420`), Rental and leasing (`V13411`), and Other operating costs (the
verified remainder against `CUB_C_705`, see "Cost-structure math" above). Colors from the
existing `CHART_COLORS` palette (6 colors defined, exact fit for 6 categories, fixed hue order
per the `dataviz` skill's categorical-color rule). The over-time stacked view is available via
the module's expandable detail/table, not as a second always-visible chart, per the spec's own
"avoid displaying both charts by default" guidance.

## i18n

New namespace `accommodationSector` in both `src/i18n/et.js` and `src/i18n/en.js`: section
heading + one-sentence subheading, the "Estonia only" note, KPI labels, module headings, chart
legend labels, and the deterministic insight sentence templates. Added to `nav.*` for the rail
entry. Exact strings are written during implementation (not placeholder text), following each
module's spec above and the example phrasing the user's original request gave (e.g. "Majutussektori
käive kasvas aastaga 6,8%.") as a style reference, not literal copy (the real sentence is built
from whatever the verified latest numbers actually are).

## Responsive/mobile

Single-column stacking below the existing site's tablet/mobile breakpoint, matching
`Page6Capacity.jsx`'s and the other page components' existing responsive CSS patterns — no new
breakpoint system needed.

## Acceptance criteria (restated, concrete)

1. "Accommodation Sector" / "Majutussektor" appears in the rail nav and renders between
   Capacity and Expenses, in both locales.
2. All 5 modules render from the 3 verified tables above, with correct source citations
   (`TableSource`, exact table ID per chart) and each KPI/chart showing its own reporting period.
3. No region selector appears in this section; the one-line "Estonia only" note is present.
4. The cost-structure donut's 6 slices sum to exactly the verified `CUB_C_705` total.
5. Hotels-vs-other split in Module 2 uses `I551` vs `I552+I553+I559`, not a guessed split.
6. Module 4's wage comparison uses PA113's own `TOTAL` row, not a value from a different table.
7. Insight sentences are deterministic, computed from the fetched data, 1–2 sentences per module.
8. Each module has an expandable table exposing the underlying values and a direct link to its
   Statistikaamet table page.
9. Works at mobile width (single column) and desktop (the layout described per module above).
10. No value in any chart, KPI, or table is copied from the reference screenshots — everything
    is fetched live.

## Explicitly out of scope

- Any regional comparison (Tallinn/Harju/Tartu/etc. vs. Estonia) for any of the 5 modules — not
  available in any Statistikaamet table, verified directly (see audit above).
- Occupation-specific wages (e.g. hotel receptionists, cleaning staff) — the spec marks this
  optional and conditional on data availability; not investigated in this pass since the core
  5 modules already fill the section, and adding it would need a separate table audit
  (`PA624`/`PA634`-family tables, which carry occupation × economic-activity × sex, not checked
  here). Can be a follow-up if wanted.
- EM041 (quarterly version of EM001) — not used; EM001's annual series plus TU410's quarterly
  revenue/growth already cover both the long-trend and the current-quarter needs without a third
  overlapping source.
