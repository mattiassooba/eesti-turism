# Frontend Redesign (Nordic/Editorial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Nordic/editorial redesign approved in
`docs/superpowers/specs/2026-08-02-frontend-redesign-design.md`: numbers-first
information hierarchy, a disciplined (not omnipresent) gold accent, a new
editorial display serif, a newsletter that no longer eats 15-20% of the
viewport permanently, no-wrap mobile nav, color-blind-safe multi-series
charts, and a real footer county-chip module — applied consistently across
the dashboard and the "Kõik tabelid" browse view.

**Architecture:** No architecture change. This is a CSS-token, JSX-ordering,
and component-styling pass over an existing React 18 + Vite 5 app. All data
flow, routing, and the AI narrative pipeline are untouched.

**Tech Stack:** React 18, Vite 5, Recharts, plain CSS (custom properties in
`src/styles/tokens.css`), self-hosted webfonts (`public/fonts/`).

## Global Constraints

- Do not change `--sea` (`#2b6ca3`), `--slate` (`#5b6b7a`), `--ink`
  (`#101b26`), `--alert` (`#9c3b26`), `--font-body` (IBM Plex Sans), or
  `--font-mono` (IBM Plex Mono) — only `--paper`, `--font-display`, and the
  *usage sites* of `--midsummer` change.
- No new npm dependencies. No Google Fonts CDN `<link>` — all fonts are
  self-hosted in `public/fonts/`, matching the existing pattern (see
  `public/fonts/fonts.css`).
- No change to `src/api/`, `src/data/`, `src/context/`, `src/i18n/`,
  routing, or any data-fetching logic in any component.
- After every task, run `npm run build` and confirm it succeeds before
  moving to the next task.
- `--midsummer` (`#d98e2b`) stays defined and is NOT removed from
  `tokens.css` — it remains used for: the brand-mark dot
  (`.top-nav-title::before`), the seasonal-rhythm gradient (signature
  element), and every `:focus-visible`/`:focus` outline in the app. It is
  removed from every *decorative default/active-state* usage (nav tab
  active state, newsletter submit button, table-leaf selected state,
  section-rail active dot, newsletter PDF-button hover, dark-footnote-link
  hover) — see Task 2 for the exact, complete list.

---

## Task 1: Self-host Fraunces, cool the paper token, swap the display font

**Files:**
- Create: `public/fonts/fraunces-400-600-latin.woff2`
- Create: `public/fonts/fraunces-400-600-latin-ext.woff2`
- Modify: `public/fonts/fonts.css`
- Modify: `src/styles/tokens.css:2-11`

**Interfaces:**
- Produces: `--font-display` now resolves to `'Fraunces'` everywhere it's
  already consumed (11 existing call sites across `dashboard.css`,
  `data-pages.css`, `operator.css`, `shell.css`, `table-view.css` — no
  per-site edits needed, they all reference `var(--font-display)`).

- [ ] **Step 1: Download the Fraunces variable-weight woff2 files**

Fraunces is served by Google Fonts as a single variable-font file per
subset covering the 400-600 weight range (confirmed by requesting the
range explicitly — both weights resolve to the same binary). Two subsets
are needed (matching the project's existing latin/latin-ext split; skip
the `vietnamese` subset like every other font here does):

```bash
curl -s "https://fonts.gstatic.com/s/fraunces/v38/6NUu8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib14c7qv8.woff2" -o public/fonts/fraunces-400-600-latin.woff2
curl -s "https://fonts.gstatic.com/s/fraunces/v38/6NUu8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib14c1qv86Rg.woff2" -o public/fonts/fraunces-400-600-latin-ext.woff2
```

- [ ] **Step 2: Verify both files downloaded correctly**

```bash
node -e "
const fs = require('fs');
for (const f of ['public/fonts/fraunces-400-600-latin.woff2', 'public/fonts/fraunces-400-600-latin-ext.woff2']) {
  const buf = fs.readFileSync(f);
  console.log(f, buf.slice(0,4).toString('ascii'), buf.length + ' bytes');
}
"
```
Expected: both print `wOF2` as the magic bytes and a size above 10000
bytes (the latin file is ~36KB).

- [ ] **Step 3: Append the Fraunces `@font-face` rules to `public/fonts/fonts.css`**

Append at the end of the file (after the last `Space Grotesk` block, i.e.
after the current line 161):

```css

@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 400 600;
  font-display: swap;
  src: url('fraunces-400-600-latin-ext.woff2') format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
}

@font-face {
  font-family: 'Fraunces';
  font-style: normal;
  font-weight: 400 600;
  font-display: swap;
  src: url('fraunces-400-600-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

Note the `font-weight: 400 600;` range syntax (not a single value) — this
is a variable font instance covering both weights in one file, so the
browser picks the right rendering from whatever `font-weight` the calling
CSS rule requests (the app already requests `font-weight: 600` at several
`var(--font-display)` call sites and no explicit weight, i.e. 400, at
others — both now resolve correctly from these two files).

- [ ] **Step 4: Update `src/styles/tokens.css`**

Change lines 2-11 from:
```css
:root {
  --ink: #101b26;
  --paper: #eef0ee;
  --sea: #2b6ca3;
  --sea-deep: #0f3a57;
  --midsummer: #d98e2b;
  --slate: #5b6b7a;
  --alert: #9c3b26;

  --font-display: "Space Grotesk", sans-serif;
  --font-body: "IBM Plex Sans", sans-serif;
```
to:
```css
:root {
  --ink: #101b26;
  --paper: #f5f6f3;
  --sea: #2b6ca3;
  --sea-deep: #0f3a57;
  --midsummer: #d98e2b;
  --slate: #5b6b7a;
  --alert: #9c3b26;

  --font-display: "Fraunces", serif;
  --font-body: "IBM Plex Sans", sans-serif;
```
(Only the `--paper` value and the `--font-display` value change; every
other line in this block is unchanged.)

- [ ] **Step 5: Build and visually confirm**

```bash
npm run build && npx vite preview --port 5195
```
Open `http://localhost:5195/` and confirm: section titles and hero stat
numbers render in Fraunces (a serif, not Space Grotesk's geometric sans),
and the page background reads as a slightly cooler off-white than before.
Stop the preview server after checking.

- [ ] **Step 6: Commit**

```bash
git add public/fonts/fraunces-400-600-latin.woff2 public/fonts/fraunces-400-600-latin-ext.woff2 public/fonts/fonts.css src/styles/tokens.css
git commit -m "Self-host Fraunces for display type, cool the paper token"
```

---

## Task 2: Restrict the gold accent to its three legitimate uses

**Files:**
- Modify: `src/styles/shell.css` (7 sites)
- Modify: `src/styles/dashboard.css` (1 site)
- Modify: `src/styles/footer-responsive.css` (1 site)

**Interfaces:**
- Consumes: `--sea`, `--ink` (from Task 1's `tokens.css`, unchanged values).
- Produces: `--midsummer` now appears in exactly 3 semantic roles across
  the whole stylesheet: the brand-mark dot, the seasonal-rhythm gradient
  (Task 3 territory, untouched here), and every focus indicator. Every
  other current usage becomes `--ink` or `--sea`, chosen to match the
  *nearest existing convention* for that kind of state (see each step).

- [ ] **Step 1: `src/styles/shell.css` — active nav tab (lines 71-75)**

Change:
```css
.top-nav-tab.active {
  color: var(--ink);
  background: var(--midsummer);
  font-weight: 600;
}
```
to:
```css
.top-nav-tab.active {
  color: var(--ink);
  background: none;
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--ink);
}
```
(An ink underline instead of a filled gold pill — quieter, editorial,
consistent with the "gold means something rare" rule. `box-shadow: inset`
rather than `border-bottom` avoids a layout shift from the added border
width.)

- [ ] **Step 2: `src/styles/shell.css` — newsletter PDF-button hover (line 128-131)**

Change:
```css
.newsletter-pdf-button:hover {
  border-color: var(--midsummer);
  filter: brightness(1.08);
}
```
to:
```css
.newsletter-pdf-button:hover {
  border-color: rgba(238, 240, 238, 0.75);
  filter: brightness(1.08);
}
```
(Brightens the existing translucent-paper border instead of switching to
gold — a quieter hover state matching the button's own quiet default
style.)

- [ ] **Step 3: `src/styles/shell.css` — newsletter submit button (lines 170-181)**

Change:
```css
.newsletter-submit {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  padding: 10px 22px;
  border: none;
  border-radius: 999px;
  background: var(--midsummer);
  color: var(--ink);
  cursor: pointer;
  transition: filter 0.15s var(--ease);
}
```
to:
```css
.newsletter-submit {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  padding: 10px 22px;
  border: none;
  border-radius: 999px;
  background: var(--ink);
  color: var(--paper);
  cursor: pointer;
  transition: filter 0.15s var(--ease);
}
```

- [ ] **Step 4: `src/styles/shell.css` — sidebar table-leaf selected state (lines 314-319)**

Change:
```css
.table-leaf.selected {
  background: var(--midsummer);
  color: var(--ink);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
```
to:
```css
.table-leaf.selected {
  background: var(--sea);
  color: #fff;
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
```
(Matches `.pill-tab.active { background: var(--sea); color: #fff; }` in
`src/styles/operator.css:103` — every other "this is the selected/active
one" state in the app already uses sea blue; this was the one
inconsistent holdout.)

- [ ] **Step 5: `src/styles/shell.css` — section-rail active dot (lines 503-508)**

Change:
```css
.section-rail-active .section-rail-dot {
  width: 11px;
  height: 11px;
  background: var(--midsummer);
  border-color: var(--midsummer);
  box-shadow: 0 0 0 4px rgba(217, 142, 43, 0.22);
}
```
to:
```css
.section-rail-active .section-rail-dot {
  width: 11px;
  height: 11px;
  background: var(--sea);
  border-color: var(--sea);
  box-shadow: 0 0 0 4px rgba(43, 108, 163, 0.22);
}
```
(Same rgba-echo-of-the-hex pattern as before, recomputed for `--sea`
`#2b6ca3` → `rgba(43, 108, 163, ...)`.)

- [ ] **Step 6: `src/styles/dashboard.css` — dark-footnote source-link hover (lines 264-266)**

Change:
```css
.table-source-dark a:hover {
  color: var(--midsummer);
}
```
to:
```css
.table-source-dark a:hover {
  color: var(--sea);
}
```
(Its light-background counterpart, `.table-source a:hover` at line 251-253,
already uses `var(--sea)` — this aligns the dark variant to match instead
of being the one place hover-gold survives.)

- [ ] **Step 7: `src/styles/footer-responsive.css` — footer link color (lines 16-18)**

Change:
```css
.source-footer a {
  color: var(--midsummer);
  text-decoration: none;
}
```
to:
```css
.source-footer a {
  color: var(--paper);
  text-decoration: underline;
  text-decoration-color: rgba(238, 240, 238, 0.4);
}
```
(Footer links become quiet paper-colored underlined text instead of gold —
consistent with the dark-background link treatment used elsewhere, e.g.
`.table-source-dark a` in `dashboard.css`. The county chip links added in
Task 7 get their own explicit color rule that overrides this, since chips
are a different visual treatment than inline text links.)

- [ ] **Step 8: Confirm the only remaining `var(--midsummer)` usages are the 3 legitimate ones**

```bash
grep -rn "var(--midsummer)" src/styles/*.css
```
Expected output — exactly these lines (brand dot, seasonal-rhythm legend
gradient stays as a hardcoded rgb pair not a var so won't appear here, and
every focus indicator):
```
src/styles/shell.css:44:  background: var(--midsummer);          (brand dot)
src/styles/shell.css:78:  outline: 2px solid var(--midsummer);   (focus)
src/styles/shell.css:166:  outline: 2px solid var(--midsummer);  (focus)
src/styles/shell.css:222:  outline: 2px solid var(--midsummer);  (focus)
src/styles/shell.css:281:  border-color: var(--midsummer);       (focus)
```
If anything else appears, revisit that site against the rule above before
proceeding.

- [ ] **Step 9: Build and commit**

```bash
npm run build
git add src/styles/shell.css src/styles/dashboard.css src/styles/footer-responsive.css
git commit -m "Restrict gold accent to brand mark, signature element, and focus rings"
```

---

## Task 3: Numbers-first ordering + quieter narrative card

**Files:**
- Modify: `src/components/Dashboard.jsx:231-233`
- Modify: `src/components/Page2Map.jsx` (NarrativeBlock at line 234, hero-card at line 237)
- Modify: `src/components/Page3Purpose.jsx` (NarrativeBlock at line 160, hero-card at line 163)
- Modify: `src/components/Page6Capacity.jsx` (NarrativeBlock at line 211, hero-card at line 213)
- Modify: `src/components/Page5Expenses.jsx` (NarrativeBlock at line 217, hero-card at line 219)
- Modify: `src/styles/dashboard.css:17-23`

**Interfaces:**
- No prop/signature changes to `NarrativeBlock` — this task only reorders
  existing JSX siblings and restyles `.narrative-card`.

- [ ] **Step 1: `src/components/Dashboard.jsx` — swap order**

The current structure (lines 222-233) is:
```jsx
<SectionFilters .../>

<NarrativeBlock section="dashboard" regionCode={region} />

<div className="kpi-row">
  <div className="hero-card">...
```
Move the `<NarrativeBlock>` line to immediately after the closing `</div>`
of `.kpi-row` (i.e., it now renders after both hero cards instead of
before them). Locate the closing tag of the `kpi-row` div (search for the
next top-level `</div>` at the same indentation as the `<div
className="kpi-row">` opening tag) and move the `<NarrativeBlock
section="dashboard" regionCode={region} />` line to immediately follow it.

- [ ] **Step 2: Repeat the same move in the other four files**

For each of `Page2Map.jsx`, `Page3Purpose.jsx`, `Page6Capacity.jsx`,
`Page5Expenses.jsx`: find that file's `<NarrativeBlock section="..." />`
call (line numbers given above reflect the current, pre-Task-3 file state)
and the `.hero-card` div immediately after it. Move the `<NarrativeBlock
.../>` line to immediately after that hero-card's closing `</div>` tag,
same as Step 1. Each file's `NarrativeBlock` call keeps its exact existing
props (only its position in the JSX moves — do not change any prop).

- [ ] **Step 3: Restyle `.narrative-card` in `src/styles/dashboard.css`**

Change lines 17-23 from:
```css
.narrative-card {
  background: #fff;
  border-left: 3px solid var(--midsummer);
  border-radius: var(--radius-md);
  padding: 20px 24px;
  box-shadow: var(--shadow-sm);
}
```
to:
```css
.narrative-card {
  background: none;
  border-left: 2px solid #dbe0df;
  border-radius: 0;
  padding: 4px 0 4px 18px;
  box-shadow: none;
}
```
And shrink the text slightly — change lines 25-31 from:
```css
.narrative-text {
  margin: 0;
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink);
}
```
to:
```css
.narrative-text {
  margin: 0;
  font-family: var(--font-body);
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--slate);
}
```
(Thin neutral rule instead of a bold gold-bordered white card; smaller,
slate-colored text instead of full-ink — reads as commentary following
the numbers, not a headline element competing with them.)

- [ ] **Step 4: Build and visually verify ordering**

```bash
npm run build && npx vite preview --port 5195
```
Load `http://localhost:5195/` and confirm the two headline stat cards
(Majutatud külastajad / Ööbimised) render before the AI narrative
paragraph on Ülevaade. Scroll to Kaart ja hooajalisus, Eesmärk ja kestus,
Mahutavus, and Reisikulutused and confirm the same ordering (stat card
first, narrative after) on each. Stop the preview server.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dashboard.jsx src/components/Page2Map.jsx src/components/Page3Purpose.jsx src/components/Page6Capacity.jsx src/components/Page5Expenses.jsx src/styles/dashboard.css
git commit -m "Move headline stat cards above AI narrative on every dashboard section"
```

---

## Task 4: Collapsible newsletter, moved into page-end flow

**Files:**
- Modify: `src/components/NewsletterSignup.jsx`
- Modify: `src/App.jsx` (remove one render site, add three)
- Modify: `src/styles/shell.css:88-238`

**Interfaces:**
- `NewsletterSignup` gains internal `expanded` state — no new props, still
  called as `<NewsletterSignup />` with no arguments, so every call site
  is a drop-in replacement of the current one.

- [ ] **Step 1: Add collapse/expand state to `NewsletterSignup.jsx`**

At the top of the component function (after the existing `const { t,
locale } = useTranslation();` and other existing `useState` calls), add:
```jsx
const [expanded, setExpanded] = useState(false);
```

Wrap the component's existing return JSX (the full `<div
className="newsletter-signup">...</div>` currently returned) in a
conditional: when `!expanded`, render a slim collapsed strip instead;
when `expanded`, render the existing full form unchanged. Concretely,
change the function's `return (...)` to:

```jsx
if (!expanded) {
  return (
    <div className="newsletter-signup newsletter-signup-collapsed">
      <button className="newsletter-cta" onClick={() => setExpanded(true)}>
        {t("newsletter.collapsedCta")}
      </button>
    </div>
  );
}

return (
  <div className="newsletter-signup">
    {/* ...existing JSX unchanged from here... */}
```
(The existing full-form JSX body doesn't change at all — only the new
`if (!expanded) { return (...) }` guard above it, and the closing of that
guard block.)

- [ ] **Step 2: Add the new translation key**

In `src/i18n/et.js`, inside the `footer: {` block is the wrong place —
find the newsletter-related keys instead (search for
`"newsletter\."` or a `newsletter:` block) and add a new key:
```js
collapsedCta: "Saa Eesti turismistatistika kokkuvõte e-postile →",
```
In `src/i18n/en.js`, in the equivalent `newsletter:` block, add:
```js
collapsedCta: "Get Estonia's tourism stats by email →",
```

- [ ] **Step 3: Style the collapsed strip in `src/styles/shell.css`**

Change the existing `.newsletter-signup` rule (lines 92-97) from:
```css
.newsletter-signup {
  flex-shrink: 0;
  background: var(--sea-deep);
  color: var(--paper);
  padding: 24px 32px;
}
```
to:
```css
.newsletter-signup {
  background: var(--sea-deep);
  color: var(--paper);
  padding: 24px 32px;
  border-radius: var(--radius-md);
  margin-top: 24px;
}

.newsletter-signup-collapsed {
  padding: 0;
  background: none;
  border-radius: 0;
}

.newsletter-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid #dbe0df;
  border-radius: 999px;
  padding: 10px 18px;
  font-family: var(--font-body);
  font-size: 13.5px;
  color: var(--ink);
  cursor: pointer;
  transition: border-color 0.15s var(--ease), background-color 0.15s var(--ease);
}

.newsletter-cta:hover {
  border-color: var(--sea);
  background: rgba(43, 108, 163, 0.05);
}

.newsletter-cta:focus-visible {
  outline: 2px solid var(--midsummer);
  outline-offset: 2px;
}
```
(`flex-shrink: 0` is removed because the component is no longer a flex
sibling of `.app-shell` — see Step 4. The collapsed state now looks like a
quiet inline pill button matching the app's other pill controls, not a
dark full-width bar.)

- [ ] **Step 4: Move the render site(s) in `src/App.jsx`**

Remove the current `<NewsletterSignup />` line (immediately before
`<SourceFooter />` near the end of the returned JSX, outside `.app-body`).

Add it instead as the last element inside each of the three view branches
within `.main-panel`, so it scrolls with that view's content and only
appears once the visitor reaches the actual end:

1. Inside the `view === "scroll"` branch: immediately after the closing
   `</div>` of the last `<section id="expenses" ...>` block (i.e., as the
   last child of `.scroll-sections`, after the Reisikulutused section),
   add `<NewsletterSignup />`.
2. Inside the `view === "residents"` branch: immediately before that
   branch's closing `</div>`, add `<NewsletterSignup />` as the last
   child.
3. Inside the `view === "browse"` branch: immediately before its closing
   `</main>`-adjacent wrapper's end — i.e., as the last child rendered in
   that branch regardless of whether `selected` is set (add it after the
   `{selected ? (...) : (...)}` conditional block, still inside the
   `view === "browse" &&` fragment, so it shows under both the
   table-selected and the quick-links-empty states).

`SourceFooter` stays exactly where it currently is (outside `.main-panel`,
still a persistent bottom strip) — this task only relocates
`NewsletterSignup`.

- [ ] **Step 5: Build and verify scroll behavior**

```bash
npm run build && npx vite preview --port 5195
```
Confirm: on load, no newsletter bar is visible at the bottom of the
viewport (only `SourceFooter`'s thin attribution strip is). Scroll to the
bottom of the Ülevaade→...→Reisikulutused scroll sequence and confirm the
collapsed "Get Estonia's tourism stats by email →" pill appears at the
true end of that content, above the footer. Click it and confirm the full
form expands in place. Switch to Residentide reisid and Kõik tabelid and
confirm the same collapsed pill appears at the end of each of those views
too.

- [ ] **Step 6: Commit**

```bash
git add src/components/NewsletterSignup.jsx src/App.jsx src/styles/shell.css src/i18n/et.js src/i18n/en.js
git commit -m "Collapse newsletter to a single-line CTA in normal document flow"
```

---

## Task 5: Mobile top nav — no wrapping at any supported breakpoint

**Files:**
- Modify: `src/styles/shell.css:9-80`

**Interfaces:** none — CSS-only, no JSX/behavior change.

- [ ] **Step 1: Add a mobile treatment below 640px**

Append after the existing `.top-nav-tab:focus-visible` rule (after line
80, before `.app-body` at line 82):

```css
@media (max-width: 640px) {
  .top-nav {
    padding: 10px 14px;
    gap: 10px;
  }

  .top-nav-title {
    font-size: 0;
  }

  .top-nav-title::before {
    width: 9px;
    height: 9px;
  }

  .top-nav-tabs {
    gap: 0;
  }

  .top-nav-tab {
    font-size: 12.5px;
    padding: 7px 10px;
  }

  .top-nav .locale-switch {
    flex-shrink: 0;
  }
}
```
(`font-size: 0` collapses the visible brand text to nothing while keeping
the gold dot marker visible — the brand name is redundant on a screen
that's already showing the site's own content, and this is the single
biggest space reclaim. Tab font-size/padding shrink further to guarantee
fit; `126.5px` × 3 tabs + dot + locale switch fits well within a 375px
viewport with this sizing — verify in Step 3.)

- [ ] **Step 2: Add an accessible label for the now-invisible brand text**

In `src/App.jsx`, find `<div className="top-nav-title">{t("app.brand")}</div>`
and change it to include a screen-reader-only fallback so the site name
remains announced by assistive tech even though it's visually hidden at
narrow widths:
```jsx
<div className="top-nav-title" aria-label={t("app.brand")}>
  <span aria-hidden="true">{t("app.brand")}</span>
</div>
```
(`font-size: 0` on the parent at narrow widths visually hides the
`aria-hidden` span's text along with it, while `aria-label` on the parent
keeps it in the accessibility tree at every width.)

- [ ] **Step 3: Build and verify at 375px, 390px, and 768px**

```bash
npm run build && npx vite preview --port 5195
```
Using browser devtools' responsive mode (or a quick Playwright script per
this project's established pattern — see `test-routing.mjs` from the SEO
work for the template), load the site at 375px and 390px widths and
confirm the top nav renders on a single line with no wrap at both. Also
check 768px and 1024px to confirm nothing regressed there (the `@media
(max-width: 640px)` block shouldn't apply above 640px).

- [ ] **Step 4: Commit**

```bash
git add src/styles/shell.css src/App.jsx
git commit -m "Prevent mobile top nav from wrapping to a second line"
```

---

## Task 6: Chart accessibility — dash patterns and a region ranked list

**Files:**
- Modify: `src/theme.js`
- Modify: `src/components/Page5Expenses.jsx:252-263`
- Modify: `src/components/Page3Purpose.jsx:193-204`
- Modify: `src/components/Page2Map.jsx`

**Interfaces:**
- Produces: `CHART_DASH_PATTERNS` (new export from `src/theme.js`), an
  array of `strokeDasharray` values indexed the same way `CHART_COLORS` is.

- [ ] **Step 1: Add dash patterns to `src/theme.js`**

After the existing `CHART_COLORS` export (line 14), add:
```js
// Paired 1:1 with CHART_COLORS by index — multi-series line/area charts
// apply both color AND dash pattern per series, so series stay
// distinguishable without relying on color alone (colorblind visitors,
// grayscale printing).
export const CHART_DASH_PATTERNS = ["0", "6 3", "2 2", "8 3 2 3", "1 3", "10 2"];
```
(`"0"` = solid line for the first series, then increasingly distinct
dash/dot patterns for the rest — 6 entries to match `CHART_COLORS`'
length.)

- [ ] **Step 2: Apply dash patterns in `Page5Expenses.jsx`**

Change the series-mapping block (lines 252-263) from:
```jsx
{data.purposeNames.map((name, i) => (
  <Area
    key={name}
    type="monotone"
    dataKey={name}
    stackId="1"
    stroke={CHART_COLORS[i % CHART_COLORS.length]}
    fill={CHART_COLORS[i % CHART_COLORS.length]}
    fillOpacity={0.75}
    isAnimationActive={false}
  />
))}
```
to:
```jsx
{data.purposeNames.map((name, i) => (
  <Area
    key={name}
    type="monotone"
    dataKey={name}
    stackId="1"
    stroke={CHART_COLORS[i % CHART_COLORS.length]}
    strokeDasharray={CHART_DASH_PATTERNS[i % CHART_DASH_PATTERNS.length]}
    strokeWidth={1.5}
    fill={CHART_COLORS[i % CHART_COLORS.length]}
    fillOpacity={0.75}
    isAnimationActive={false}
  />
))}
```
And add `CHART_DASH_PATTERNS` to this file's existing import from
`"../theme"` (find the line importing `CHART_COLORS` from `../theme` and
add `CHART_DASH_PATTERNS` to that same import list).

- [ ] **Step 3: Apply the identical change in `Page3Purpose.jsx`**

Same edit, same two changes (the `<Area>` props and the theme import), at
lines 193-204 of `src/components/Page3Purpose.jsx` — this file's series
loop is structurally identical to Page5Expenses.jsx's per the existing
codebase (both map over a `purposeNames` array with the same prop set).

- [ ] **Step 4: Add a ranked region list to `Page2Map.jsx`**

The map currently shows region values only on hover/focus (via the SVG
`<title>` and `EstoniaMap`'s own caption element) — add an always-visible
ranked list alongside it, mirroring the existing "Top 5 väliskülastajate
päritoluriiki" `RankedBarList` pattern already used in this same file
(lines 259-281) for country data.

`Page2Map.jsx` already computes `countyTotals` (a `{mkood: value}` map,
used to color the choropleth) — add a derived sorted array for the list.
Near where `topCounty` is computed (around lines 118-123), add:
```jsx
const rankedCounties = useMemo(() => {
  if (!base.data?.countyTotals) return [];
  return Object.entries(base.data.countyTotals)
    .map(([mkood, value]) => ({ mkood, value, label: countyLabelByMkood(mkood, locale) }))
    .filter((c) => c.label)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}, [base.data?.countyTotals, locale]);
```
(Reuses `countyLabelByMkood` — already imported in this file per its
existing use for the map. If `useMemo` isn't already imported from
`"react"` in this file, add it to the existing React import line.)

Then, in the JSX where `<EstoniaMap .../>` renders (line 248, inside the
`.tile-row-split` alongside the countries `RankedBarList`), add a second
`RankedBarList` for `rankedCounties` immediately after the map, using the
same `<RankedBarList>` component and prop shape as the existing countries
list at lines 259-281 (same component, different data: `items={
rankedCounties.map(c => ({ label: c.label, value: c.value })) }`, same
title-prop pattern but with a heading like `t("map.byCountyHeading")`
instead of the countries one — add that translation key to `et.js`/`en.js`
alongside the other `map:` keys, e.g. `"Ööbimised maakonna järgi"` /
`"Nights by county"`).

- [ ] **Step 5: Build and verify**

```bash
npm run build && npx vite preview --port 5195
```
Scroll to Kaart ja hooajalisus and confirm: the 5-series area chart on
Reisikulutused/Eesmärk ja kestus now shows visibly different dash patterns
per series (not just color); the map now has an always-visible ranked
list of counties by value next to it, not only a hover tooltip.

- [ ] **Step 6: Commit**

```bash
git add src/theme.js src/components/Page5Expenses.jsx src/components/Page3Purpose.jsx src/components/Page2Map.jsx src/i18n/et.js src/i18n/en.js
git commit -m "Add series dash patterns and an always-visible county ranking to the map"
```

---

## Task 7: Footer county chip grid

**Files:**
- Modify: `src/components/SourceFooter.jsx`
- Modify: `src/styles/footer-responsive.css`

**Interfaces:** no change to `SourceFooter`'s own props (still `<SourceFooter />`, no args).

- [ ] **Step 1: Restructure the county list markup in `SourceFooter.jsx`**

Find the existing `<nav className="footer-counties" ...>` block (currently
rendering `<span className="footer-counties-label">` plus a `.map()` over
`[...COUNTIES, ...CITIES]` producing comma-separated `<span><Link>...`
pairs). Replace the inner mapping so each county renders as its own chip,
with no comma-join logic needed:
```jsx
<nav className="footer-counties" aria-label={t("footer.allCounties")}>
  <span className="footer-counties-label">{t("footer.allCounties")}</span>
  <div className="footer-counties-grid">
    {[...COUNTIES, ...CITIES].map((county) => (
      <Link
        key={county.code}
        className="footer-county-chip"
        to={locale === "en" ? `/en/county/${county.slugEn}` : `/maakond/${county.slugEt}`}
      >
        {locale === "en" ? county.en : county.et}
      </Link>
    ))}
  </div>
</nav>
```

- [ ] **Step 2: Add the chip grid CSS to `src/styles/footer-responsive.css`**

Replace the existing `.footer-counties` and `.footer-counties-label`
rules (current lines 25-33) with:
```css
.footer-counties {
  flex-basis: 100%;
  margin-top: 4px;
}

.footer-counties-label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  opacity: 0.75;
}

.footer-counties-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.footer-county-chip {
  display: inline-flex;
  border: 1px solid rgba(238, 240, 238, 0.25);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 11px;
  color: rgba(238, 240, 238, 0.75) !important;
  text-decoration: none !important;
  transition: border-color 0.15s var(--ease), color 0.15s var(--ease);
}

.footer-county-chip:hover {
  border-color: var(--sea);
  color: var(--paper) !important;
}

.footer-county-chip:focus-visible {
  outline: 2px solid var(--midsummer);
  outline-offset: 2px;
}
```
(The `!important` on color/text-decoration overrides the generic
`.source-footer a` rule from Task 2 Step 7, since chips need their own
quiet-outline treatment rather than underlined inline-text styling —
this is the one place in the redesign an `!important` is warranted,
since `.footer-county-chip` and `.source-footer a` both legitimately
target the same `<a>` elements with different intents.)

- [ ] **Step 3: Build and verify**

```bash
npm run build && npx vite preview --port 5195
```
Scroll to the footer (visible on every view) and confirm the county list
now renders as a grid of individually outlined pill chips rather than a
comma-separated line of underlined gold text, and that each chip still
navigates correctly on click.

- [ ] **Step 4: Commit**

```bash
git add src/components/SourceFooter.jsx src/styles/footer-responsive.css
git commit -m "Redesign footer county list as a chip grid"
```

---

## Task 8: Apply the same tokens to "Kõik tabelid" + contrast verification

**Files:**
- Modify: `src/styles/table-view.css`
- Modify: `src/styles/data-pages.css`
- No modification expected to `src/styles/operator.css` (already uses the
  shared tokens exclusively per Section 5/6 of the pre-plan audit — grep
  found no direct `#d98e2b` or `Space Grotesk` literals there).

**Interfaces:** none — verification + token-driven styling, no component changes expected.

- [ ] **Step 1: Grep for any hardcoded colors/fonts bypassing the token system**

```bash
grep -n "#d98e2b\|#D98E2B\|Space Grotesk" src/styles/table-view.css src/styles/data-pages.css src/styles/operator.css src/theme.js
```
`src/theme.js:10` (`FOREIGN_COLOR = "#d98e2b"`) and `src/theme.js:14`
(inside `CHART_COLORS`) are expected hits — these are JS constants, not
CSS, and are intentionally left as literal hex per the Global Constraints
(chart series colors are unchanged, only their *CSS-token* decorative
usage changed in Task 2). Any *other* hit (a literal hex or "Space
Grotesk" string inside a `.css` file, not going through `var(--midsummer)`
/ `var(--font-display)`) means that rule was missed by Tasks 1-2 and
needs the same treatment applied there — go back and fix it using the
same before/after pattern as the matching case in Task 2.

- [ ] **Step 2: Visual pass over Kõik tabelid**

```bash
npm run build && npx vite preview --port 5195
```
Open the "Kõik tabelid" tab and confirm: section headers render in
Fraunces (via `.table-view h2`/`.data-card h3`, both already
`var(--font-display)` consumers, so this should already be correct with
zero code changes — this step is verification, not implementation), the
background reads as the new cooler paper tone, and no gold is visible
anywhere in this view outside of focus rings when tabbing through
controls.

- [ ] **Step 3: Contrast check on the new `--paper`/`--ink` pairing**

```bash
node -e "
function luminance(hex) {
  const rgb = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(hex1, hex2) {
  const l1 = luminance(hex1), l2 = luminance(hex2);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}
console.log('ink on paper:', contrast('101b26', 'f5f6f3').toFixed(2), '(need >= 4.5)');
console.log('slate on paper:', contrast('5b6b7a', 'f5f6f3').toFixed(2), '(need >= 4.5 for narrative text)');
console.log('ink on midsummer (active-tab underline text, not fill):', contrast('101b26', 'd98e2b').toFixed(2), '(need >= 4.5)');
"
```
All three ratios must be ≥ 4.5. If `slate on paper` fails (it's the
closest to the threshold, since `--slate` is a mid-tone and the new
narrative text uses it per Task 3), that's the one value in this whole
plan allowed to change as a fix: darken `--slate` slightly in
`tokens.css` (e.g. to `#4d5c6a`) and re-run this check until it passes,
then re-run `npm run build`.

- [ ] **Step 4: Commit (only if Step 3 required a `--slate` adjustment; otherwise this task has nothing to commit)**

```bash
git add src/styles/tokens.css
git commit -m "Darken --slate to meet WCAG AA contrast on the new paper tone"
```

---

## Task 9: Extend the seasonal-rhythm motif to section dividers (signature element)

**Files:**
- Modify: `src/styles/shell.css:355-366`

**Interfaces:** none — CSS-only.

**Context:** `src/colorScale.js`'s `seasonalityColor()` gradient (quiet
blue `rgb(77,120,148)` → midsummer gold `rgb(217,142,43)`) currently only
appears in one place: the small "Vaikne hooaeg → Tipphooaeg" legend strip
inside one hero card (`.seasonality-legend-gradient`,
`dashboard.css:184-189`). Per the approved spec, this becomes the site's
recurring signature motif — reused as the divider between scroll
sections, so the page's own rhythm (Ülevaade → Kaart → Eesmärk → Mahutavus
→ Reisikulutused) visually echoes the seasonal rhythm the gradient
represents.

- [ ] **Step 1: Replace the flat grey section divider with the seasonal gradient**

Change `src/styles/shell.css` lines 355-366 from:
```css
.scroll-section {
  /* Room to breathe above the section when scrollIntoView lands on it,
     and a clear break between what used to be separate tabs. */
  scroll-margin-top: 16px;
  padding-top: 20px;
  border-top: 1px solid #dbe0df;
}

.scroll-section:first-child {
  padding-top: 0;
  border-top: none;
}
```
to:
```css
.scroll-section {
  /* Room to breathe above the section when scrollIntoView lands on it,
     and a clear break between what used to be separate tabs. The divider
     itself echoes the seasonality strip's quiet-to-midsummer gradient
     (src/colorScale.js) — the site's signature motif, reused here so the
     page's own section-to-section rhythm nods at the seasonal rhythm the
     data describes. */
  position: relative;
  scroll-margin-top: 16px;
  padding-top: 24px;
}

.scroll-section::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 64px;
  height: 2px;
  background: linear-gradient(to right, rgb(77, 120, 148), rgb(217, 142, 43));
  border-radius: 2px;
}

.scroll-section:first-child {
  padding-top: 0;
}

.scroll-section:first-child::before {
  display: none;
}
```
(A short 64px gradient rule instead of a full-width flat grey line — deliberately
small and quiet like the existing legend strip, not a loud full-width
banner, consistent with "gold appears rarely and means something" from
Task 2.)

- [ ] **Step 2: Build and verify**

```bash
npm run build && npx vite preview --port 5195
```
Scroll through Ülevaade → Kaart ja hooajalisus → Eesmärk ja kestus →
Mahutavus → Reisikulutused and confirm each section (except the first)
now opens with a short blue-to-gold gradient rule instead of a flat grey
line, and that it reads as a deliberate recurring motif rather than
decoration.

- [ ] **Step 3: Commit**

```bash
git add src/styles/shell.css
git commit -m "Reuse the seasonal-rhythm gradient as the section-divider motif"
```

---

## Task 10: Full before/after verification pass

**Files:** none modified — verification only, using this project's
established Playwright-screenshot-audit pattern (see `test-routing.mjs`
and the screenshot audit from this session's brainstorming phase).

- [ ] **Step 1: Screenshot every changed area at desktop and mobile**

Write a Playwright script (in the scratch directory, not the repo) that,
against `npx vite preview`, captures: `/` at 1440×900 and 390×844 (confirm
numbers-first ordering, no newsletter bar, Fraunces headings, cooler
paper), the Kaart section at both sizes (confirm dash-patterned chart,
region ranked list), the footer (confirm chip grid), and the mobile top
nav specifically at 375px and 390px (confirm no wrap).

- [ ] **Step 2: Confirm zero console/page errors**

Same pattern as `test-routing.mjs` — collect `pageerror` and console
`error`-type events across all captured routes/interactions and confirm
the array is empty.

- [ ] **Step 3: Re-run the SEO prerender to confirm it still produces real content**

```bash
npm run build && node scripts/prerender.mjs
grep -o '<title>[^<]*</title>' dist/maakond/hiiu-maakond/index.html
```
Confirm this still prints the real Hiiu-specific title (the redesign must
not have broken the prerendering pipeline from the earlier SEO work).

- [ ] **Step 4: Report findings to the user before any push**

Summarize what the screenshots show, any deviations from the design spec
encountered during implementation and why, and confirm readiness — do not
push without explicit confirmation, per this project's established
workflow.
