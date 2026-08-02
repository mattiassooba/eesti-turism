# Eesti Turism — Design

> Originally written 2026-07-04 as the v1 design spec for a personal PxWeb
> browsing tool. Rewritten 2026-08-02 to describe the site as it actually
> is now — a public dashboard with AI narrative, per-region SEO pages, and
> a newsletter — ahead of a frontend visual redesign. The July 4 v1 scope
> (generic folder/table browser) still exists, but only as the secondary
> "Kõik tabelid" view; it is no longer the product's primary surface.

## Purpose

"Eesti Turism" is a public tourism-statistics site for Estonia: a
dashboard of visitor, accommodation, and spending trends built on
Statistics Estonia (Statistikaamet) data, plus a secondary raw-table
browser for anyone who wants to explore the underlying PxWeb tables
directly. Live at `turismistatistika.ee`.

Audience has broadened from the original single-user prototype to the
general public — the site is indexed by Google, has a bilingual (ET/EN)
newsletter, and is built for organic/long-tail search discovery
(journalists, researchers, tourism operators, policymakers, and anyone
searching for a specific region's tourism numbers).

## Data sources

**Statistics Estonia PxWeb API** (unchanged from v1) — `andmed.stat.ee`,
PxWeb 2020, public REST, CORS-enabled, no backend/proxy needed:
- `GET` on a folder path lists children; `GET` on a table id returns
  metadata (variables, codes, possible values); `POST` with a query body
  returns data (`json-stat2` by default).
- In-scope tables live under `majandus/turism-ja-majutus` (majutus,
  eesti-elanike-reisimine, turismi-ja-majutuse-majandusnaitajad).
- Rate limits (1000 calls/10s, 25M cells/call) are generous for
  interactive single-visitor use.

**AI-generated narrative** (new since v1) — `public/data/narrative.json`,
regenerated monthly by `scripts/generate-narrative.mjs` (GitHub Actions
cron, `generate-narrative.yml`, 5th of each month) using the Anthropic
API. Contains a national blurb and a per-region blurb
(`sections.dashboardByRegion`, keyed by region code) for the dashboard,
in both ET and EN, plus similar blurbs for other sections. Fetched
client-side at runtime (`src/data/narrative.js`); a missing/malformed file
degrades silently (narrative block just doesn't render — see
`NarrativeBlock.jsx`).

## Scope (current)

**Primary: the dashboard.** A single continuous page combining five
scroll sections — Ülevaade (Dashboard/overview), Kaart ja hooajalisus
(map + seasonality), Eesmärk ja kestus (trip purpose/duration), Mahutavus
(accommodation capacity), Reisikulutused (spending) — plus two sibling
tabs that replace the scroll view: Residentide reisid (residents'
domestic trips) and Kõik tabelid (the v1 generic table browser). A
top bar switches between the three destinations (dashboard scroll /
residents / browse); a floating `SectionRail` navigates within the
scroll.

**Region + language dimensions cut across everything.** A region
selector (`OperatorInsights.jsx`, 18 entries: 15 maakonds + Tallinn/
Pärnu/Tartu city sub-splits, `src/data/counties.js`) re-slices the
dashboard's charts and AI narrative to one region. Every page renders in
Estonian or English (`src/i18n/`). Both dimensions are encoded in the URL
(see Routing below), not just local state.

**Secondary: Kõik tabelid**, the original v1 scope — recursive
folder/table browser, filters, sortable grid, chart, CSV/XLSX/PNG
export — unchanged in spirit from the original design, still exists as
its own tab for anyone who wants raw PxWeb access instead of the curated
dashboard.

**Newsletter.** A Mailchimp-embedded signup form (`NewsletterSignup.jsx`)
with monthly/quarterly cadence and language preference groups, plus a
"download this month's PDF" button (`NewsletterPdfButton.jsx`, renders
the current dashboard to PDF via html2canvas + jspdf). `send-newsletter.mjs`
runs in the same monthly GitHub Actions job as narrative generation,
sending the AI-written summary as a Mailchimp campaign.
Note: `NewsletterSignup.jsx`'s Mailchimp form action/group IDs are still
literal `PLACEHOLDER_*` constants in the component as of this writing —
worth confirming those were swapped for real Audience/Group IDs before
or during a redesign of that component.

**SEO.** Meta tags, OG/Twitter cards, JSON-LD, `robots.txt`, and a
38-URL `sitemap.xml` (2 root + 18 regions × 2 languages) are generated at
build time; every region+language combination is prerendered to real
static HTML via Playwright (`scripts/prerender.mjs`) so crawlers see
actual content, not an empty SPA shell. Full detail below under Routing
& SEO.

Still out of scope: authentication, multi-user accounts, server-side
data caching, automated tests.

## Architecture

Static single-page app: **React 18 + Vite 5**, built to plain static
files, deployed to GitHub Pages (custom domain via `public/CNAME`). No
backend/database — the browser calls the PxWeb API directly at runtime;
AI narrative and newsletter sends happen in scheduled CI, not at request
time.

Libraries (grown substantially since v1):
- **react-router-dom** — client routing for `/`, `/en`, `/maakond/:slug`,
  `/en/county/:slug`.
- **Recharts** — line/bar/area charts throughout the dashboard.
- **TanStack Table** — sortable grid (Kõik tabelid view).
- **d3-geo + topojson-client** — `EstoniaMap.jsx`'s county choropleth.
- **SheetJS (xlsx)** — CSV/XLSX export (Kõik tabelid view).
- **html2canvas + jspdf** — newsletter PDF snapshot export.
- **@anthropic-ai/sdk** (devDependency, CI-only) — monthly narrative
  generation script, not shipped to the browser.
- **playwright** (devDependency, CI-only) — build-time prerendering.

## Routing & SEO

Four route patterns, all rendered by one catch-all `<Route path="*">` in
`App.jsx` (content is identical regardless of which matched — locale and
region are derived from the raw pathname, not from route params, since
`LocaleContext`/`RegionContext` sit above `<Routes>` in the tree):

- `/` — Estonian, default region (Harju)
- `/en` — English, default region
- `/maakond/:slug` — Estonian, region set from the slug
- `/en/county/:slug` — English, region set from the slug

`locale` and `region` are pure functions of `location.pathname`
(`useLocation()` + regex matching — see `LocaleContext.jsx` and
`RegionContext.jsx`), not stored state: the same URL must always render
the same content for every visitor, including crawlers, since these are
meant to be independently indexable pages. Switching language or region
navigates (`useNavigate`) to the equivalent URL rather than flipping
local state. `useDocumentMeta.js` sets `document.title`, meta
description, canonical link, and OG/Twitter tags per route at runtime.

Two-phase SEO delivery:
1. **Routing** gives each of the 38 region×language combinations
   (15 maakonds + 3 cities × 2 languages, + 2 root pages) its own real
   URL.
2. **Prerendering** (`scripts/prerender.mjs`, runs in `deploy.yml` after
   `vite build`) serves the build locally, drives headless Chromium
   through all 38 routes, waits for the region's AI narrative text to
   render, and saves the fully-rendered HTML into
   `dist/<route>/index.html` — so the content is present in the raw HTTP
   response, not only after JS executes. Also regenerates
   `dist/sitemap.xml` with all 38 URLs.

`postbuild` (`scripts/copy-404.mjs`) copies `dist/index.html` to
`dist/404.html` — the standard GitHub Pages SPA-routing fallback, since
GH Pages has no server-side rewrites and a direct visit to
`/maakond/harju-maakond` would otherwise 404.

`SourceFooter.jsx` renders a real `<a href>` link list to all 18 region
pages (in the current locale) on every page, so crawlers discover them
by following links, not only via the sitemap.

## Components

**Layout/shell:** `App.jsx` (routes, top nav, locale switch, scroll
orchestration), `SectionRail.jsx` (floating in-page nav), `ErrorBoundary`,
`SourceFooter.jsx`, `LazyMount.jsx` (defers offscreen dashboard sections).

**Dashboard scroll sections:** `Dashboard.jsx` (Ülevaade — headline
stats, cumulative yearly tables, residency chart), `Page2Map.jsx` +
`EstoniaMap.jsx` + `SeasonalityHeatmap.jsx`/`SeasonalityStrip.jsx` (Kaart
ja hooajalisus), `Page3Purpose.jsx` (Eesmärk ja kestus), `Page6Capacity.jsx`
(Mahutavus), `Page5Expenses.jsx` (Reisikulutused).

**Other tabs:** `Page4Residents.jsx` (Residentide reisid, standalone),
`OperatorInsights.jsx` (region selector + region-scoped charts, feeds the
region into `RegionContext`), `TableView.jsx` + `Sidebar.jsx` +
`FilterBar.jsx` + `DataGrid.jsx` + `ChartPanel.jsx` + `ExportButtons.jsx`
(Kõik tabelid — the original v1 generic browser, unchanged in spirit).

**Shared chart primitives:** `ChartTooltip.jsx`, `RankedBarList.jsx`,
`Sparkline.jsx`, `SplitBar.jsx`, `TableSource.jsx`, `SectionFilters.jsx`,
`colorScale.js`, `theme.js` (chart color tokens, kept in sync by hand
with the CSS custom properties in `App.css`: `--sea`, `--midsummer`,
`--slate`, `--sea-deep`, `--ink`).

**Content/growth:** `NarrativeBlock.jsx` (renders the AI blurb for a
section, region-aware), `NewsletterSignup.jsx`, `NewsletterPdfButton.jsx`.

**Data/state:** `api/pxweb.js` + `api/jsonStat.js` (PxWeb client +
json-stat2 flattening, unchanged from v1), `data/counties.js` (region
list + slugs), `data/narrative.js` (fetches `narrative.json`),
`i18n/LocaleContext.jsx` + `i18n/et.js` + `i18n/en.js`,
`context/RegionContext.jsx`, `hooks/useAbortableEffect.js`,
`hooks/useActiveSection.js` (scroll-spy for `SectionRail`),
`hooks/useDocumentMeta.js`.

## Data flow

**Live PxWeb data** (dashboard + Kõik tabelid): unchanged from v1 —
fetch table metadata to drive filters, `POST` a query, flatten
`json-stat2` into rows (grid) and series (chart). Dashboard components
fetch their own broad slice once and apply region/residency/year filters
client-side rather than refetching per filter change.

**AI narrative**: build-independent — `narrative.json` is fetched once
at runtime by any component rendering a `NarrativeBlock`, cached in
module state (`data/narrative.js`) so multiple sections on one page
share a single fetch.

**Region-specific view**: `RegionContext` derives the active region code
from the URL; components needing region-scoped data (charts, narrative)
read it via `useRegion()` and filter their already-fetched dataset by
that code.

## Error handling

Unchanged from v1: failed fetches show an inline error with Retry, no
automatic retry/backoff (rate limits are generous for interactive use).
`NarrativeBlock` degrades silently instead of showing an error, since
missing AI content isn't a failure state worth surfacing to visitors.

## Testing

Still no automated test suite. Verification remains manual, now
routinely done via ad-hoc Playwright smoke scripts (drive the dev server
or a `vite preview` of `dist/`, assert on rendered text/titles/URLs,
check for console errors) rather than exercising the UI by hand — see
this session's `test-routing.mjs`/`test-footer.mjs` pattern for the
template. `scripts/prerender.mjs`'s own run is itself a lightweight
regression check: it fails loudly (per-route console-error logging) if a
route stops rendering real content.

## Known gaps / caveats for whoever redesigns the frontend

- `NewsletterSignup.jsx` Mailchimp IDs may still be literal placeholders
  in the deployed component (see above) — check before assuming the
  signup form is live.
- `recharts` and a few other chunks exceed Vite's 500kB warning
  threshold on build; not addressed, not blocking, but worth knowing
  before adding more chart weight.
- Visual design tokens (colors, type, spacing) currently live only in
  `App.css`/`theme.js` by convention, not documented separately from the
  code — read those directly rather than trusting any description here,
  since a redesign will change them.
