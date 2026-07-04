# Tourism Statistics UI — Design

## Purpose

A personal test tool for browsing Statistics Estonia's tourism/accommodation
data (Turism, majutus ja toitlustus, under Majandus) without using the
andmed.stat.ee web interface directly. Lets the user browse tables, filter
them, view results as a sortable datasheet and as charts, and export the
current view.

Audience: single user (author), for personal evaluation. Not intended for
external users or hosting in this iteration.

## Data source

Statistics Estonia's statistical database (`andmed.stat.ee`) runs on
**PxWeb 2020** and exposes a public REST API:

- Base: `https://andmed.stat.ee/api/v1/et/stat/...`
- `GET` on a folder path returns its children (`type: "l"` = folder,
  `type: "t"` = table).
- `GET` on a table id returns its metadata: variables, their codes, and
  possible values (`variables[].code`, `.values`, `.valueTexts`, `.time`,
  `.elimination`).
- `POST` on a table id with a JSON query body (per-variable
  `code`/`selection.filter`/`selection.values`) returns data. Default
  response format is `json-stat2`; `csv`, `csv2`, `csv3`, `xlsx`, `px`,
  `sdmx` are also available.
- Verified live: `https://andmed.stat.ee/api/v1/et/stat/majandus/turism-ja-majutus`
  returns 3 subfolders — `eesti-elanike-reisimine`, `majutus`,
  `turismi-ja-majutuse-majandusnaitajad`. `majutus` alone has 13 tables
  (TU11, TU110–TU116, TU121, TU122, TU131, TU133, TU17).
- `CORS: true` is set on the API (confirmed via
  `https://andmed.stat.ee/api/v1/en?config`), so the browser can call it
  directly — no backend proxy is required.
- Rate limits: 1000 calls / 10s window, max 25,000,000 values/cells per
  call — generous for interactive use.

## Scope (v1)

All 3 subfolders under `turism-ja-majutus` are in scope, browsable via a
folder tree. No table is hardcoded — the sidebar and filter options are
built from live API responses (folder listing + table metadata), so newly
published tables/values show up automatically.

Out of scope for v1: authentication, multi-user support, server-side
caching, scheduled refresh, combining/joining multiple tables into one
view, automated tests.

## Architecture

Static single-page app: **React + Vite**, built to plain static files.
No backend — the browser calls the PxWeb API directly, relying on its
CORS support.

Libraries:
- **Recharts** — line and bar charts.
- **TanStack Table** — sortable data grid.
- **SheetJS (xlsx)** — CSV/XLSX export of the current filtered rows.
- Chart PNG export via canvas snapshot (Recharts renders to SVG; convert
  to canvas/PNG on export, or use a small SVG-to-PNG helper).

## Data flow

1. On load, fetch the folder tree rooted at
   `stat/majandus/turism-ja-majutus`, recursively expanding all subfolders
   to populate the sidebar (folders and tables both shown, tables are
   leaf/clickable nodes).
2. Selecting a table fetches its metadata (`GET` on the table id) to get
   every variable's code, label, and possible values. This drives the
   filter UI — no variable list is hardcoded per table.
3. Changing filters (or on first load with defaults) issues a `POST` query:
   - Non-time variables default to their elimination value if eliminable,
     otherwise all values (per API's own default-selection rules) unless
     the user has picked specific values.
   - The time variable defaults to `filter: "top", values: ["24"]` (last
     24 periods) so a table isn't empty or overwhelming by default.
   - Response format requested: `json-stat2`.
4. The json-stat2 response is flattened into row objects (one per data
   point, with resolved dimension labels) for the grid, and into series
   arrays (grouped by a user-chosen "group by" dimension) for the chart.

## Components

- `Sidebar` — recursive folder/table tree; lazy-loads a folder's children
  on first expand (caches the result so re-expanding doesn't refetch).
- `TableView` — top-level view for a selected table; owns metadata + data
  fetch state and coordinates the child components below.
- `FilterBar` — one control per non-time variable (dropdown, or multi-select
  where useful); a separate control for the time range (e.g. last N
  periods, or explicit range).
- `DataGrid` — TanStack Table instance over the flattened rows; sortable
  columns, one row per data point.
- `ChartPanel` — Recharts line chart (default, for time-series) with a
  toggle to bar chart (for single-period category comparisons); splits
  into series by a user-selected "group by" variable when the table has
  more than one non-time dimension.
- `ExportButtons` — "Export CSV", "Export XLSX" (current filtered rows via
  SheetJS), "Export PNG" (current chart).

## Error handling

Minimal, appropriate for a single-user test tool:
- Any failed fetch (network error, non-2xx, including `429 Too Many
  Requests`) shows an inline error message in place of the affected panel
  (sidebar, filters, grid, or chart) with a "Retry" button.
- No automatic retry/backoff — the generous rate limit (1000 calls/10s)
  makes this unnecessary for interactive single-user use.

## Testing

No automated test suite for v1. Verification is manual: exercise the app
against a handful of real tables spanning all 3 subfolders (e.g. TU121,
TU11, and one table each from Eesti elanike reisimine and Turismi ja
majutuse majandusnäitajad) to confirm folder browsing, filtering,
grid/chart rendering, and all three export formats work end-to-end.
