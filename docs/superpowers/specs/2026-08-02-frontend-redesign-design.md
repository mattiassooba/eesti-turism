# Eesti Turism — Frontend Redesign (Nordic/Editorial) — Design

## Purpose

A visual/UX redesign of the existing dashboard, informed by the
`ui-ux-pro-max` skill's design intelligence and a screenshot-grounded
audit of the current site (see findings below). This is a **presentation
and information-hierarchy redesign**, not an architecture change: routing,
data flow, i18n, the AI narrative pipeline, and SEO/prerendering (all
described in `2026-07-04-tourism-stats-ui-design.md`) are unaffected and
out of scope here. That spec remains the source of truth for
architecture; this one is the source of truth for how it should look and
read.

Direction, chosen by the site owner: **Nordic/editorial minimalism** —
quiet, precise, generous whitespace, restrained color, closer to a
well-made data-journalism piece (FT/Economist-style charts and headline
treatment) than a SaaS analytics product. Refine the existing identity
rather than replace it — the current sea-blue/midsummer-gold/ink palette
and IBM Plex type family are already close to right; the problems are in
*how* they're used (gold overused as a default active-state color,
information ordered narrative-first instead of numbers-first, one
component permanently eating a fifth of the viewport), not in the palette
itself.

## Audit findings (grounds for every change below)

Captured via Playwright screenshots of the running dev server at desktop
(1440×900) and mobile (390×844) viewports, cross-checked against
`ui-ux-pro-max`'s UX/chart-domain guidance:

1. **Newsletter signup is a persistent fixed-height bottom bar** (not
   part of document flow) — visible at every scroll position on every
   section, consuming ~140–150px (~15–20%) of a 900px viewport
   permanently, whether or not the visitor has any interest in
   subscribing.
2. **Mobile shows zero numbers on first screen.** At 390px, the AI
   narrative paragraph (5–6 dense sentences) sits above the headline stat
   cards on every scroll section, so the first full mobile screen is
   100% text.
3. **Mobile top nav wraps to two lines**, costing ~180px of an 844px
   viewport before any content renders — 3 nav items + language switch
   shouldn't need to wrap at that width.
4. **Chart series are differentiated by color only.** The seasonality
   area chart (5 overlapping series) and the choropleth map both rely
   solely on hue, which `ui-ux-pro-max`'s chart-domain data flags
   explicitly (line/area: "differentiate by line style, not color alone";
   choropleth: accessibility grade B without a text fallback).
5. **The footer's "all counties" link list** (added for SEO) is a plain
   comma-separated wall of gold links — functional for crawlers, visually
   an afterthought now that real visitors see it too.
6. **Unverified, needs a contrast check during implementation:** light
   text on the gold (`#d98e2b`) active-tab pill may not clear WCAG AA
   4.5:1 — gold backgrounds are a common spot for this to quietly fail.

## Color

Same hue family — this is a *discipline* change, not a palette swap.

| Token | Current | New | Rationale |
|---|---|---|---|
| `--paper` | `#eef0ee` | `#F5F6F3` | Cooler, quieter — reads as newsprint rather than generic light-grey UI chrome |
| `--ink` | `#101b26` | unchanged | Already correct |
| `--sea` | `#2b6ca3` | unchanged | Already correct — primary data color |
| `--slate` | `#5b6b7a` | unchanged | Already correct — secondary/comparison series |
| `--midsummer` | `#d98e2b` | unchanged value, **usage restricted** | Currently the default color for active tabs, badges, card borders, map highlight, and every footer link — i.e. it means nothing because it's everywhere. New rule: gold appears at most once per screen, reserved for the single most important element (see Signature element below). Everywhere it's currently used as a generic "active/accent" color, replace with ink, sea, or a neutral border instead. |
| `--alert` | `#9c3b26` | unchanged | Already fits the mood |

**Contrast check required during implementation:** verify `--ink` on
`--paper` and any remaining text-on-`--midsummer` pairing meet WCAG AA
(4.5:1 body text / 3:1 large text) with the new, slightly cooler paper
tone.

## Typography

- **Body / labels / UI chrome:** IBM Plex Sans — unchanged.
- **Numbers / tabular data:** IBM Plex Mono — unchanged.
- **Display (section headings + the large hero stat numbers, e.g. the
  "320 292" majutatud-külastajad figures):** replace Space Grotesk with
  **Fraunces** (variable-weight display serif). This is the one
  deliberate new choice — it's what supplies the editorial/data-
  journalism gravity the direction calls for, while staying distinctive
  rather than defaulting to a generic serif (Georgia/Times-adjacent).
  Heavy optical size + weight for hero numbers; lighter weight for
  section titles.

Font-loading note: Fraunces is a variable font (large glyph set across
many axes) — for implementation, subset to the weights/optical sizes
actually used rather than loading the full variable range, to avoid
regressing the performance budget `ui-ux-pro-max`'s checklist calls out.

## Layout changes, by area

### Dashboard scroll sections (Ülevaade, Kaart, Eesmärk, Mahutavus,
Reisikulutused)

- **Numbers-first ordering:** headline stat cards move above the
  `NarrativeBlock` AI text on every section (currently narrative is
  first). Applies uniformly — no per-device variation.
- **Narrative treatment downgraded:** from a full-width card with a bold
  gold left border and tinted background to a quieter aside — smaller
  type, a thin neutral (not gold) left rule, positioned after the
  numbers as supporting commentary rather than a headline element.
- **Seasonal-rhythm bar (signature element):** the existing "Vaikne
  hooaeg → Tipphooaeg" gradient strip (currently a small inline element
  inside one stat card) becomes a recurring visual motif — reused as a
  section-divider treatment elsewhere in the scroll, not confined to its
  current single appearance. This is the one place gold/warm color is
  expected to still read prominently, since it's the designated
  signature element, not a default UI accent.

### Newsletter (`NewsletterSignup.jsx`)

- Changes from a fixed, always-visible bottom bar to a normal
  document-flow element — collapsed by default to a single-line strip
  ("Get monthly Estonia tourism stats by email →" / Estonian equivalent),
  positioned at the true end of the page (after the last scroll section
  / after the residents or browse view's content), expanding to the full
  form (cadence/language/county selectors) on click or focus.
- This directly resolves audit finding #1 — reclaims the permanent
  ~15–20% viewport cost.

### Top navigation (mobile)

- Needs a layout that keeps `Ülevaade` / `Residentide reisid` / `Kõik
  tabelid` + the ET/EN switch on one line at 390px width — exact
  treatment (icon-only tabs, a condensed label set, or a menu affordance)
  is an implementation-time decision, not fixed here, but the constraint
  is firm: **no wrapping to a second line** at any supported breakpoint
  (375/768/1024/1440, per the skill's checklist).

### Charts

- **Multi-series line/area charts** (seasonality, trip-purpose
  breakdowns): add line-style differentiation (solid/dashed/dotted) per
  series in addition to existing color, so series remain distinguishable
  without color.
- **Choropleth map (`EstoniaMap.jsx`):** add a compact, always-visible
  ranked text list of region values next to the map — the same pattern
  the site already uses for "Top 5 väliskülastajate päritoluriiki" (top
  source countries), extended to cover the map's own region values so
  they're not color-only.
- Bar charts already show value labels and are already reasonably
  accessible per the skill's own criteria — no change needed there
  beyond the general color/type refresh.

### Footer

- **County link list:** replace the current comma-separated inline
  gold-link wall with a real designed module — a grid of quiet,
  outlined chips (not solid gold fills), still real `<a href>` elements
  for SEO purposes (no change to the underlying markup's crawlability,
  only its visual presentation).

### "Kõik tabelid" (raw table browser)

- Same visual system applied throughout (new tokens, typography,
  spacing) — per the owner's decision, this should feel like the same
  product as the dashboard, not a separate, older-feeling tool bolted on.
  No structural/functional change to this view — sidebar tree, filters,
  grid, chart, export buttons all keep their current behavior.

## Non-goals

- No change to routing, data flow, the AI narrative generation pipeline,
  newsletter send mechanics, or SEO/prerendering — all covered by
  `2026-07-04-tourism-stats-ui-design.md` and unaffected by this spec.
- No change to the underlying PxWeb data-fetching, filtering logic, or
  which charts/tables exist — this is presentation and hierarchy only.
- Not swapping the core hue family or the body/mono type — only the
  display face and the *usage discipline* of the existing accent color
  change.

## Testing

Consistent with the project's existing approach (no automated test
suite): verify manually via the same Playwright-screenshot-audit pattern
used to ground this spec — before/after screenshots at 1440×900 and
390×844 for each changed area, confirming numbers-first ordering, the
newsletter strip's collapsed/expanded states, no mobile nav wrap, and
visible line-style differentiation on multi-series charts. Run a
contrast check (e.g. via browser devtools or an automated axe pass) on
the revised `--paper`/`--ink`/`--midsummer` pairings specifically, since
finding #6 above is flagged but not yet confirmed.
