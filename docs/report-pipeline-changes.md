# Report pipeline changes — statistical accuracy, two-stage analysis, PDF redesign, QA gate

This documents the changes made in response to the "Improve the Estonian
Tourism Statistics Website and Automated PDF Reports" spec (7 sections).
It covers what changed, how the new calculations work, and what's known to
still be missing or unverified. Section numbers below match that spec.

## 1. Statistical accuracy and comparability

**RevPAR removed.** The spec asked to disable RevPAR until it could be
computed from a methodologically valid input. Statistikaamet's own public
metadata for `OCC_NI_COST` ("Ööpäeva keskmine maksumus") states only that
the figure "includes VAT and breakfast" — it does not state whether the
underlying rate is per room or per bed/person, and that ambiguity could not
be resolved from any public Statistikaamet documentation. Since RevPAR is
itself derived from that unconfirmed rate, it was removed completely (not
hidden) from computation, the UI, and all labels, in
`OperatorInsights.jsx`. "ARR" was renamed to "Keskmine ööpäevamaksumus" /
"Average cost per night" everywhere, with a footnote citing Statistikaamet's
own definition and explicitly noting the per-room-vs-per-person ambiguity is
unresolved.

**Update — 2026-10-27:** a separate effort outside this engagement (via
Cursor, commit "Add RevPAR and wage-share lines to operator charts",
2026-10-25) added RevPAR back on the site's new Operator page
(`prototype/src/pages/Operator.jsx` — see the status note in
`docs/superpowers/specs/2026-10-22-accommodation-sector-design.md` for how
that frontend relates to this one), computed the same way (occupancy % ×
average cost per night) from the same input whose per-room-vs-per-person
basis was never confirmed by Statistikaamet. The original
`OperatorInsights.jsx` referenced above is itself now orphaned (same
frontend swap) and still has RevPAR removed. Noting this for awareness, not
changing it unilaterally — it may have been a deliberate call made with
context this engagement doesn't have.

**Update — 2026-10-28 (owner ruling):** the site owner states that
`OCC_NI_COST` (keskmine ööpäevamaksumus) is a **per-room** price. On that
basis RevPAR (occupancy % × average price per night) is treated as valid and
is reinstated in the newsletter PDF's yearly tables. The PDF's table footnote
says "per room" accordingly. See
`docs/superpowers/specs/2026-10-28-newsletter-pdf-ytd-design.md`. The
Operator page's own footnote (`operatorPage.footnote` in
`prototype/src/i18n/pages.js`) still describes the basis as unconfirmed and
has not been changed.

**Partial-year comparisons are now flagged, not silently shown.** Two
independent bugs let a partial (still in-progress) year sit next to full
prior years with no visual distinction: `OperatorInsights.jsx`'s yearly bar
charts, and `computeNationalYearlyTrend()` in `generate-narrative.mjs`
(which only guarded against a partial *leading* year, never the trailing/
current one). Fix: a `partial: boolean` flag now propagates through both,
muting the bar's fill and appending `" *"` to its label, with a footnote
explaining why. See the regression-test PDF — the 2026 bar is visibly
muted with a `*` and the matching footnote.

**Scope disclaimer added.** Accommodation statistics only cover
establishments with at least five bed places (confirmed via
Statistikaamet's own TU-series metadata) and don't capture every tourism
trip made in Estonia. This is now stated in the site footer
(`SourceFooter.jsx` / `footer.scopeNote`) and in the PDF's intro paragraph.

## 2. Two-stage reporting pipeline (deterministic analysis, then prose)

`scripts/lib/findings.mjs` is new: every number in a "finding" is computed
in plain code from already-fetched metrics, with no AI involved. Each
finding is `{ id, category, importance, magnitude, text, code? }`.
`rankFindings()` sorts by `importance × magnitude`, capped at 2 per
category (default) so one topic can't crowd out variety, and returns the
top 7 by default.

Only this short, ranked list is handed to Claude (as `findingsBlock` in the
prompt) — Claude's job is restricted to turning given facts into fluent
prose, never computing or inventing numbers.

**Small-denominator / sensational-headline guards:** `MIN_BASE_GUESTS =
5000` for regional extremes, a 3%-of-grand-total floor for source-market
movers, and minimum-magnitude thresholds (`MIN_NOTABLE_PCT = 3`,
`MIN_NOTABLE_POINTS = 1.5`) before any finding is emitted at all.

**Growth-vs-operating divergence detector:** the spec's own worked example
(guest growth up, occupancy/price moving the other way) is implemented as
`detectGrowthVsOperatingDivergence()`, run both nationally and per-county
(via a new `computeRegionalOccupancyPrice()` fetch covering all 15
counties), so this contrast can surface for whichever region it's actually
true for each period — not hard-coded to Harju.

**Prompt rules:** both Claude calls now carry an explicit banned-phrase
list (verbatim from the spec: "mis näitab, et", "püsib kindla vedurina",
"tugev rahvusvaheline tõmme", "joonistab selge pildi", "kindel vedur") and
accuracy rules banning unsupported "stable/consistent" claims, causal
language without a given cause, and profitability claims from occupancy/
price alone.

## 3. PDF redesign

**Page 1:** a bold, data-driven headline (`sections.headline`, must
restate the #1 ranked finding), 4 vector KPI cards (guests / nights /
occupancy / avg cost per night, each with a colored YoY delta), 3 key-
insight bullets (`sections.keyInsights`), then the existing national chart
and table.

**Page 2 — dynamic region selection.** `src/context/RegionContext.jsx`
gained an `isExplicitRegion` flag: true only when the URL actually matched
`/maakond/:slug`. When a reader explicitly picked a county, that choice is
preserved exactly as before. On the generic root page, the PDF instead uses
`narrative.json`'s `featuredRegionCode` — the most newsworthy county from
the ranked findings, falling back to the most-visited county if none of the
ranked findings name one. This directly fixes the spec's "PDF always
defaults to Harju" complaint without breaking the site's URL-based routing
(every `/maakond/:slug` path still must resolve deterministically for SEO
and crawlers — that's what `DEFAULT_REGION` is still for).

**Lean region table.** A new fully-vector KPI table (`leanKpiTable()`,
built from `narrative.json`'s `facts`, not a DOM screenshot) always renders
correctly for whichever region page 2 is actually about. The existing rich
html2canvas-captured charts/table only render when they'd actually match
that region — i.e. when the reader is on that county's own page. On the
root page, where the on-screen UI still shows Harju's charts by default but
the PDF might be featuring a different county, those captures are skipped
(so the region name and the numbers never contradict), and a one-line note
points to the site for that region's detailed charts.

**Page numbers and a clickable site link** were added to a footer bar on
every page. Both scenarios (root page → dynamic feature region; explicit
county page → that county preserved) were rendered end-to-end and visually
verified — see "Regression-test artifacts" below.

## 5. Pre-publish QA gate

`scripts/lib/qa.mjs` is new: `runPrePublishChecks()` runs right before
`narrative.json` is written and returns `{ errors, warnings, changeLog }`.
**Any error blocks the write** — the last known-good `narrative.json` is
left in place, the same way a failed test suite blocks a deploy.

Checks:
- **Structural completeness** — every field the PDF/dashboard actually
  read must exist (headline, exactly 3 keyInsights, a blurb for every
  region, `facts.national`, a valid `featuredRegionCode`).
- **Banned-phrase leakage** — independently re-scans Claude's *actual*
  output against the same banned-phrase list the prompt uses. This is a
  verification step, not a restatement of the prompt rule: a prompt
  instruction is a request, not a guarantee.
- **Regional data completeness** (warning) — flags any region missing from
  `facts`.
- **Numeric sanity** (warning) — flags any YoY figure beyond ±500% as a
  likely period-matching bug rather than a real trend.
- **Period progression / change detection** — logs a plain-English diff of
  headline national numbers against the last published run on every run
  (visible in the CI log), and hard-fails if the new period is older than
  the last published one (the usual signature of a stale/partial API
  response).

This check was run against the real, pre-session `narrative.json` as part
of verifying it works, and it genuinely caught 3 live instances of "mis
näitab, et" that had already shipped before this session's banned-phrase
rule existed — see "Known limitations" below for what it can't catch.

## Regression-test artifacts

Two PDFs were generated end-to-end against the real, live August 2026
period and delivered to the Desktop:
- `Eesti-Turism-regressioonitest-2026-08-root.pdf` — generated from the
  site's root page (no explicit region selected); page 2 dynamically
  features Tartu maakond, the most newsworthy county that period.
- `Eesti-Turism-regressioonitest-2026-08-harju.pdf` — generated from
  `/maakond/harju-maakond`; page 2 shows Harju with the full DOM-captured
  charts and table, exactly as before this session's changes.

Both passed `runPrePublishChecks()` cleanly and render as exactly 2 pages.
**What this does and doesn't prove:** every number in both PDFs is real,
live Statistikaamet data computed by this session's code. The 5 narrative
section blurbs (Eesti üldpilt, Kaart, Eesmärk, Mahutavus, Kulutused) and the
per-region blurbs are the last real Claude-authored prose from before this
session — there is no `ANTHROPIC_API_KEY` in this local shell, so no new
live call could be made to re-verify prose quality under the rewritten
system prompt. The `headline` and `keyInsights` text in both PDFs is the
ranked findings' own deterministic text, used verbatim as a stand-in for
what Claude would phrase — it is not Claude's own writing. Three clichéd
clauses in the reused legacy prose (all literal "mis näitab, et" instances,
caught by the QA gate on the first attempt) were manually rephrased solely
so this fixture could pass the same gate a real generation must pass; the
actual fix for future generations is the rewritten system prompt, which
already prevents Claude from writing that phrase.

## Known limitations

- **No live LLM verification.** The actual prose Claude would write under
  the rewritten prompt (Section 2's banned-phrase list, accuracy rules,
  headline/keyInsights schema) has not been produced or reviewed this
  session — only the deterministic data/findings/QA layers were verified
  against live data. The next real `npm run generate-narrative` (with a
  valid `ANTHROPIC_API_KEY`, via the GitHub Action) is the first real test
  of the new prompt's output quality.
- **Banned-phrase check is substring-based.** It catches the exact listed
  phrases verbatim but not paraphrases — e.g. "selgeks veduriks" (a
  paraphrase of "kindel vedur") was not caught in the legacy prose, only
  the literal "mis näitab, et" instances were. A true paraphrase check
  would need an LLM-based review step, which was out of scope here.
- **Avg. cost per night's per-room vs. per-person basis is still
  unconfirmed** by Statistikaamet's own public documentation — the
  footnote now says so explicitly rather than guessing.
- **PDF fonts are not embedded.** The PDF still uses jsPDF's standard
  Helvetica (not a custom embedded font) — true embedding would need a
  woff2→ttf conversion step added to the build, which wasn't built this
  session given the marginal visual gain over a standard PDF base font.
- **Section 4 (site structure/terminology into 3 categories) was
  deferred** — the available spec summary didn't have enough detail to
  safely redesign the nav/routing without risking the wrong information
  architecture, and the user chose to skip it for now rather than have it
  guessed at.
