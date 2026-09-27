# Quiet Dashboard Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Act on the two design-research artifacts already produced for this site
(`Dashboard Redline` — a UI/UX audit against real analytics-app patterns; `Style
Directions` — four candidate visual directions pulled from Mobbin). This plan
adopts **Direction 03 (quiet metric cards, near-zero chrome)** as the hero/stat
visual language, borrows **Direction 04's lighter map treatment** as a small
optional polish, and separately fixes the audit's other concrete findings that
don't depend on picking a direction at all.

**Direction decision, stated explicitly:** Direction 03 was chosen because it
directly resolves the audit's #1 finding (hero cards are ~280px tall for two
numbers) and is the lowest-risk fit for a data-reference site — it doesn't fight
any of the audit's "keep" findings (cross-chart color consistency, map+list
density). Direction 01 (no dashboard chrome at all) and Direction 02
(celebratory, saturated yearly recap) are **explicitly not adopted** in this
plan — 01 would undercut the site's "serious data tool" signal, and 02 risks
readability once 18 regions' worth of numbers are involved. Direction 02 stays
a candidate for the monthly newsletter/PDF only, as a separate, later
exploration — not in scope here.

**Architecture:** Visual/CSS and light JSX-structure changes only. No change to
routing, data fetching, the AI narrative pipeline, or SEO/prerendering.

**Tech Stack:** React 18, Vite 5, plain CSS (custom properties in
`src/styles/tokens.css`).

## Global Constraints

- Do not change `--sea`, `--sea-deep`, `--ink`, `--slate`, `--midsummer`,
  `--alert`, `--paper`, `--font-display`, `--font-body`, `--font-mono` values —
  only new tokens are added (see Task 1), existing ones are reused, not
  redefined.
- The `.data-grid` class used by "Kõik tabelid" (the raw PxWeb table browser)
  must NOT change — it's a different, intentionally denser view. Task 2's
  quieter table styling is scoped to the two operator-comparison cards only
  (`#operator-yearly-national`, `#operator-yearly-card`), never applied
  globally to `.data-grid`.
- After every task, run `npm run build` and confirm it succeeds before moving
  to the next task.
- No new npm dependencies.

**Left out of this plan, deliberately** — real findings from the Redline
audit, smaller than the top three and needing more than a CSS pass: the
"Kõik tabelid" empty-state dead zone (needs actual content/copy
decisions) and the filter pills' small touch targets with no swipe
alternative (an interaction redesign, not a style change). Worth a short
follow-up plan once this one ships and settles. Two other small audit
findings — the section rail's hover affordance and the mobile heading
duplication — turned out cheap enough to fold in here instead (Tasks 5
and 6), since both land in files this plan already touches.

---

## Task 1: Quiet hero cards (Direction 03)

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/dashboard.css`

**Interfaces:** No JSX changes — `Dashboard.jsx`, `Page2Map.jsx`,
`Page3Purpose.jsx`, `Page6Capacity.jsx`, `Page5Expenses.jsx` all render
`.hero-card` today with no prop changes needed; this task is CSS-only.

- [ ] **Step 1: Add a `--positive` token**

The current `.delta-up`/`.delta-down` colors (`#8fd3a0` pastel green,
`#f2a08e` pastel salmon) were tuned for light text on the old dark hero
background. On a white card they're too low-contrast. `--alert` (`#9c3b26`)
already exists for negative/error semantics — add a matching positive
token. In `src/styles/tokens.css`, in the `:root` block, add one line after
`--alert`:
```css
--positive: #1f7a52;
```

- [ ] **Step 2: Restyle `.hero-card`**

In `src/styles/dashboard.css`, change:
```css
.hero-card {
  position: relative;
  overflow: hidden;
  flex: 1;
  min-width: 320px;
  /* Deep-sea gradient with a faint midsummer glow in the corner — the
     signature treatment: evening sun over the water, tying the hero
     cards directly to the seasonality-strip color story below them. */
  background:
    radial-gradient(480px 320px at 100% -10%, rgba(217, 142, 43, 0.22), transparent 60%),
    linear-gradient(155deg, #164a6e 0%, var(--sea-deep) 55%, #0b2e45 100%);
  background-color: var(--sea-deep);
  color: var(--paper);
  border-radius: var(--radius-lg);
  padding: 30px 32px;
  box-shadow: var(--shadow-hero);
}
```
to:
```css
.hero-card {
  /* Quiet card (Direction 03 from the Style Directions review): white,
     bordered, no gradient — the old dark "evening sun over the water"
     treatment tied this card to the seasonality strip's color story
     ambiently; that link now lives only in the strip's own gradient
     (still gold-to-slate), not the card background. Deliberate trade,
     made to fix the audit's #1 finding: these cards were ~280px tall
     for two numbers, nearly 2x taller than comparable dashboards use. */
  position: relative;
  overflow: hidden;
  flex: 1;
  min-width: 280px;
  background: #fff;
  color: var(--ink);
  border: 1px solid #dbe0df;
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 3: Flip the label/number/caption/delta colors for a light background**

Change:
```css
.hero-label {
  font-family: var(--font-body);
  font-size: 13px;
  color: rgba(238, 240, 238, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
}

.hero-number {
  font-family: var(--font-mono);
  font-size: 60px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
}

.hero-number-text {
  font-family: var(--font-display);
  font-size: 34px;
  letter-spacing: 0;
}

.hero-delta {
  font-family: var(--font-body);
  font-size: 14px;
  margin-top: 10px;
}

.delta-up {
  color: #8fd3a0;
}

.delta-down {
  color: #f2a08e;
}
```
to:
```css
.hero-label {
  font-family: var(--font-body);
  font-size: 12.5px;
  color: var(--slate);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.hero-number {
  font-family: var(--font-mono);
  font-size: 40px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.hero-number-text {
  font-family: var(--font-display);
  font-size: 26px;
  letter-spacing: 0;
  color: var(--ink);
}

.hero-delta {
  font-family: var(--font-body);
  font-size: 13px;
  margin-top: 8px;
}

.delta-up {
  color: var(--positive);
}

.delta-down {
  color: var(--alert);
}
```
(`.hero-number` drops from 60px to 40px — still clearly the largest figure
on the page, since `.tile-number` elsewhere is 26px, but no longer the
dominant driver of card height. `.hero-caption` at dashboard.css:59-64
already uses `rgba(238, 240, 238, 0.55)` — change that one too, to
`var(--slate)`, same reasoning.)

- [ ] **Step 4: Fix the inline seasonality-strip cells for a light card**

The 12-cell mini strip inside the visitor-count hero card assumed a dark
background. Change:
```css
.seasonality-cell {
  flex: 1;
  height: 100%;
  border-radius: 5px 5px 2px 2px;
  border: 1px solid rgba(238, 240, 238, 0.2);
  transition: transform 0.15s var(--ease);
}
```
to:
```css
.seasonality-cell {
  flex: 1;
  height: 100%;
  border-radius: 5px 5px 2px 2px;
  border: 1px solid rgba(16, 27, 38, 0.12);
  transition: transform 0.15s var(--ease);
}
```
And its legend text color — change:
```css
.seasonality-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-family: var(--font-body);
  font-size: 11px;
  color: rgba(238, 240, 238, 0.6);
}
```
to:
```css
.seasonality-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--slate);
}
```

- [ ] **Step 5: Build and verify**

```bash
npm run build && npx vite preview --port 5230
```
Load `http://localhost:5230/` and confirm: the two hero cards (Majutatud
külastajad / Ööbimised) render as white bordered cards noticeably shorter
than before, numbers and labels are legible (dark text on white), the
seasonality strip's 12 cells are still visible and readable, and the
up/down delta arrows show a real green/red instead of washed-out pastel.
Scroll through Kaart ja hooajalisus, Eesmärk ja kestus, Mahutavus, and
Reisikulutused and confirm every hero card on every section picked up the
same change (they all share this CSS).

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/styles/dashboard.css
git commit -m "Restyle hero cards as quiet white cards (Direction 03)"
```

---

## Task 2: Quiet the Eesti-vs-region comparison tables

**Files:**
- Modify: `src/styles/operator.css`

**Interfaces:** No JSX changes — scoped purely by the existing `#operator-yearly-national` and `#operator-yearly-card` container IDs already on these two cards in `OperatorInsights.jsx`.

- [ ] **Step 1: Add a scoped override after the existing `.operator-table` rules**

The shared `.data-grid` class draws a full border on every cell
(`table-view.css:124-130`), which is correct for "Kõik tabelid" (a real
spreadsheet browser) but is exactly what makes this comparison read as a
different, older product pasted under the hero cards. Add this block to
the end of `src/styles/operator.css`:
```css
/* Quiet variant for the two Eesti-vs-region comparison cards specifically
   — everywhere else, .data-grid's full cell borders are correct (Kõik
   tabelid is meant to read as a real spreadsheet). Here, next to the
   quiet hero cards above them (see dashboard.css .hero-card), the same
   full grid read as a mismatched, older product. Row separators only,
   no vertical lines, tabular numerals so the numbers still align. */
#operator-yearly-national .data-grid,
#operator-yearly-card .data-grid {
  border: none;
}

#operator-yearly-national .data-grid th,
#operator-yearly-national .data-grid td,
#operator-yearly-card .data-grid th,
#operator-yearly-card .data-grid td {
  border: none;
  border-bottom: 1px solid #eef0ee;
  font-variant-numeric: tabular-nums;
}

#operator-yearly-national .data-grid th,
#operator-yearly-card .data-grid th {
  background: none;
  border-bottom: 1px solid #dbe0df;
}

#operator-yearly-national .data-grid tbody tr:last-child td,
#operator-yearly-card .data-grid tbody tr:last-child td {
  border-bottom: none;
}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build && npx vite preview --port 5230
```
On Ülevaade, confirm the two "vs Eesti" comparison tables now show only
horizontal row separators (no vertical grid lines, no shaded header
background), while "Kõik tabelid" still shows its full bordered grid
exactly as before (open that tab and check — this confirms the scoping
didn't leak).

- [ ] **Step 3: Commit**

```bash
git add src/styles/operator.css
git commit -m "Quiet the Eesti-vs-region comparison tables to match the hero cards"
```

---

## Task 3: Move the heatmap legend above the grid

**Files:**
- Modify: `src/components/SeasonalityHeatmap.jsx`
- Modify: `src/i18n/et.js`
- Modify: `src/i18n/en.js`

**Interfaces:** New translation key `heatmap.explainer`, consumed only by `SeasonalityHeatmap.jsx`.

- [ ] **Step 1: Add the translation key**

In `src/i18n/et.js`, inside the `heatmap:` block, add:
```js
explainer: "Iga ruut on üks kuu — värv näitab, kas majutati vähe (sinine) või palju (kollane) külastajaid.",
```
In `src/i18n/en.js`, inside the `heatmap:` block, add:
```js
explainer: "Each square is one month — color shows whether guest numbers were low (blue) or high (yellow) that month.",
```

- [ ] **Step 2: Render it above the grid**

In `src/components/SeasonalityHeatmap.jsx`, change the return statement
from:
```jsx
return (
  <div className="heatmap-wrapper">
    <div
      className="heatmap-grid"
```
to:
```jsx
return (
  <div className="heatmap-wrapper">
    <p className="heatmap-explainer">{t("heatmap.explainer")}</p>
    <div
      className="heatmap-grid"
```

- [ ] **Step 3: Style the explainer**

In `src/styles/map.css`, add after the existing `.heatmap-wrapper` rule:
```css
.heatmap-explainer {
  margin: 0 0 12px;
  font-family: var(--font-body);
  font-size: 12.5px;
  color: var(--slate);
}
```

- [ ] **Step 4: Build and verify**

```bash
npm run build && npx vite preview --port 5230
```
Scroll to Kaart ja hooajalisus and confirm a one-line explanation now
appears directly above the heatmap grid, in both languages (switch ET/EN
to check both).

- [ ] **Step 5: Commit**

```bash
git add src/components/SeasonalityHeatmap.jsx src/styles/map.css src/i18n/et.js src/i18n/en.js
git commit -m "Add a one-line explainer above the seasonality heatmap"
```

---

## Task 4: Differentiate the newsletter CTA from the PDF button

**Files:**
- Modify: `src/styles/shell.css`

**Interfaces:** No JSX changes.

- [ ] **Step 1: Make the PDF button visually secondary**

Currently `.newsletter-cta` and `.newsletter-pdf-button` (inside
`.newsletter-signup-collapsed`) are both solid pill buttons of similar
weight, even though one asks for an email commitment and the other is a
single-tap download. In `src/styles/shell.css`, find
`.newsletter-signup-collapsed .newsletter-pdf-button` (added when the PDF
button was surfaced in the collapsed strip) and change its border/text
treatment to read as clearly secondary:
```css
.newsletter-signup-collapsed .newsletter-pdf-button {
  border-color: transparent;
  color: var(--slate);
  text-decoration: underline;
  text-decoration-color: #dbe0df;
  padding-inline: 4px;
}

.newsletter-signup-collapsed .newsletter-pdf-button:hover {
  color: var(--ink);
  text-decoration-color: var(--slate);
}
```
(Replaces the existing pill-button look for this specific context with a
quiet underlined text link — still fully clickable, no longer competing
with the email CTA's pill for attention. This rule is scoped to
`.newsletter-signup-collapsed`, so the button keeps its existing pill
style inside the expanded form, where it sits next to the heading, not
next to a competing CTA.)

- [ ] **Step 2: Build and verify**

```bash
npm run build && npx vite preview --port 5230
```
Scroll to the end of any section and confirm: the collapsed newsletter
strip shows "Get stats by email →" as a clear pill button and "Download
PDF" as a quieter underlined text link beside it, not two equal buttons.

- [ ] **Step 3: Commit**

```bash
git add src/styles/shell.css
git commit -m "Make the PDF download link visually secondary to the email CTA"
```

---

## Task 5: Give the section rail a real hover affordance

**Files:**
- Modify: `src/styles/shell.css`

**Interfaces:** No JSX changes.

- [ ] **Step 1: Add a hover fill to `.section-rail-item`**

Today, hovering a rail item only darkens its label text
(`.section-rail-item:hover .section-rail-label`, already in shell.css) —
nothing signals the row itself is clickable, unlike a dashboard sidebar
row with a visible hover background. Change:
```css
.section-rail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
}
```
to:
```css
.section-rail-item {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  margin: 0 -8px;
  border-radius: 999px;
  transition: background-color 0.15s var(--ease);
}

.section-rail-item:hover {
  background: rgba(16, 27, 38, 0.05);
}
```
(The negative margin offsets the added horizontal padding so the dot and
label don't visually shift position — only the hover-state background
grows past them, matching the pill shape used for buttons elsewhere on
the site.)

- [ ] **Step 2: Build and verify**

```bash
npm run build && npx vite preview --port 5230
```
On the dashboard scroll view, hover each dot in the floating rail and
confirm a soft pill-shaped background now appears behind the whole row,
not just a text color change.

- [ ] **Step 3: Commit**

```bash
git add src/styles/shell.css
git commit -m "Add a hover fill to the section rail so it reads as clickable"
```

---

## Task 6: Stop the mobile dashboard heading repeating the nav tab

**Files:**
- Modify: `src/styles/shell.css`

**Interfaces:** No JSX changes — `#dashboard` is already a unique id on
that `<section>` in `App.jsx:236`, so this is a pure CSS scope, no
component edit needed.

- [ ] **Step 1: Hide just the first section's own title on narrow screens**

Only the dashboard section's heading duplicates information the active
nav tab already shows ("Ülevaade" twice, back to back, before any number
loads) — the other four section titles (Kaart ja hooajalisus, Eesmärk ja
kestus, Mahutavus, Reisikulutused) stay useful as wayfinding once
scrolled past the top, so only this one should go. Add this rule inside
the existing `@media (max-width: 640px)` block in `src/styles/shell.css`
(starts at line 84 — add this as the last rule before that block's
closing `}`):
```css
#dashboard .scroll-section-title {
  display: none;
}
```

- [ ] **Step 2: Build and verify**

```bash
npm run build && npx vite preview --port 5230
```
At 390px width, confirm the "Ülevaade" heading no longer appears directly
under the top nav (the active "Ülevaade" tab is still there, so the page
isn't unlabeled). Scroll down and confirm "Kaart ja hooajalisus," "Eesmärk
ja kestus," "Mahutavus," and "Reisikulutused" still show their own
headings as normal. Check at 768px/1024px too and confirm nothing changed
there (the media query shouldn't apply above 640px).

- [ ] **Step 3: Commit**

```bash
git add src/styles/shell.css
git commit -m "Hide the redundant dashboard heading on mobile"
```

---

## Task 7 (optional, lower priority): Mute the map's color scale

**Files:**
- Modify: `src/colorScale.js`

**Interfaces:** No signature change — `seasonalityColor(t)` keeps the same function shape, only its internal RGB endpoints change. Consumed by both `EstoniaMap.jsx` and `SeasonalityHeatmap.jsx` — changing it here affects both the choropleth map and the heatmap grid's color range identically, which is intentional (the whole point of sharing this function is that "low value" and "high value" mean the same colors everywhere).

**Do this task last, and only if the earlier tasks read well** — this is a
polish nudge toward Direction 04's "lighter, warmer" map treatment, not a
fix for a problem the audit identified.

- [ ] **Step 1: Soften both gradient endpoints**

Change:
```js
const QUIET = [77, 120, 148];
const MIDSUMMER = [217, 142, 43];
```
to:
```js
const QUIET = [140, 165, 182];
const MIDSUMMER = [224, 168, 96];
```
(Both endpoints pulled toward a lighter, less saturated version of the
same slate-to-gold story — same hues, softer. This changes the
choropleth map's fill colors and the heatmap grid's cell colors together,
plus the two legend gradients that hardcode these same RGB values in CSS:
`src/styles/dashboard.css`'s `.seasonality-legend-gradient` and
`src/styles/map.css`'s `.heatmap-legend-gradient` both currently read
`linear-gradient(to right, rgb(77, 120, 148), rgb(217, 142, 43))` —
update both to `linear-gradient(to right, rgb(140, 165, 182), rgb(224, 168, 96))`
so the legend swatch still matches what the map/heatmap actually show.)

- [ ] **Step 2: Build and verify**

```bash
npm run build && npx vite preview --port 5230
```
Check the choropleth map and the heatmap grid both render with the
softer palette, and that both legend gradient swatches (dashboard hero
card + heatmap) still visually match the actual map/grid colors.

- [ ] **Step 3: Commit**

```bash
git add src/colorScale.js src/styles/dashboard.css src/styles/map.css
git commit -m "Soften the map/heatmap color scale toward Direction 04's lighter palette"
```

---

## Task 8: Full verification pass

**Files:** none modified — verification only.

- [ ] **Step 1: Screenshot sweep**

Using the established Playwright-screenshot pattern from this project's
prior redesign work, capture `/` at 1440×900 and 390×844, confirm: hero
cards read as quiet white cards with legible dark text, the comparison
tables show only horizontal separators, the heatmap explainer appears
above the grid, the newsletter/PDF pairing reads as primary/secondary,
hovering a section-rail dot shows a real pill-shaped background, and the
390px view no longer shows "Ülevaade" twice above the fold.

- [ ] **Step 2: Contrast check**

The new `--positive` (`#1f7a52`) and reused `--alert` (`#9c3b26`) on
white, plus `var(--ink)` and `var(--slate)` on white (`.hero-label`,
`.hero-caption`), should all already clear WCAG AA given they're existing
or slate/ink-family tokens — confirm with the same contrast-ratio script
used in the original redesign plan rather than assuming.

- [ ] **Step 3: Confirm zero console errors**

Collect `pageerror` and console `error` events across the full scroll and
both languages; confirm the array is empty.

- [ ] **Step 4: Confirm the SEO prerender pipeline still works**

```bash
npm run build && node scripts/prerender.mjs
grep -o '<title>[^<]*</title>' dist/maakond/hiiu-maakond/index.html
```
Confirm it still prints a real region-specific title — this redesign
touches shared CSS/components the prerender snapshots depend on.

- [ ] **Step 5: Report and stop before pushing**

Summarize what the screenshots show and confirm readiness. Do not push
without explicit confirmation, per this project's established workflow.
