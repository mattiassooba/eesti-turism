// Generates the small AI-written "newsletter" blurbs shown under each
// scroll section (Ülevaade, Kaart ja hooajalisus, Eesmärk ja kestus,
// Mahutavus, Reisikulutused), plus one region-specific variant of the
// Ülevaade blurb per entry in the dashboard's region picker (15 maakonds +
// Tallinn/Tartu/Pärnu city). Run standalone under Node (not the browser
// bundle) — imports the same fetch/flatten helpers the app itself uses,
// since both are pure fetch-based with no browser-only APIs.
//
// Each section's metrics mirror that page's own default view (same
// residency/time-range/region defaults a first-time visitor sees), fetched
// via /et/ (Statistikaamet's own English "top" filter has a locale bug —
// see src/api/pxweb.js — and Claude reliably translates Estonian proper
// nouns into its English output anyway, as verified in production use).
//
// Usage: ANTHROPIC_API_KEY=... node scripts/generate-narrative.mjs
// Optional: ANTHROPIC_MODEL=claude-sonnet-5 (default), --force to skip the
// idempotency guard.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { fetchTableData } from "../src/api/pxweb.js";
import { flattenToRows } from "../src/api/jsonStat.js";
import { formatPeriodLabel } from "../src/i18n/format.js";
import { COUNTIES, CITIES } from "../src/data/counties.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "..", "public", "data", "narrative.json");

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];
const REISIMINE_PATH = ["majandus", "turism-ja-majutus", "eesti-elanike-reisimine"];

const ALL_REGIONS = [...COUNTIES, ...CITIES];

const ORIGIN_COUNTRY_CODES = ["FI", "LV", "DE", "SE", "RU", "LT", "NO", "UK", "US", "FR", "NL", "PL", "IT", "ES", "DK"];

const DURATION_LABELS_ET = { "N1-3": "1 kuni 3 ööd", "N4-7": "4 kuni 7 ööd", N_GT7: "Üle 7 öö" };

const EXPENSE_CATEGORY_LABELS_ET = {
  EXP_TRA: "Transport",
  EXP_ACC: "Majutus",
  EXP_REST: "Toit ja jook",
  EXP_OTH: "Muu (meelelahutus, ostud, teenused)",
};

function periodDelta(series, latestIndex, offset) {
  const compareIndex = latestIndex - offset;
  if (compareIndex < 0) return null;
  const latest = series[latestIndex];
  const compare = series[compareIndex];
  if (!compare) return null;
  return ((latest - compare) / compare) * 100;
}

function fmtPct(n) {
  if (n == null) return "no comparable data a year ago";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// Large counts read like a newsletter, not a spreadsheet — Claude is
// instructed (see FORMATTING_RULES) to keep these exact abbreviated forms,
// translating only the unit word, rather than spelling out the full number.
function abbrev(n) {
  if (n == null) return "n/a";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} million`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)} thousand`;
  return n.toLocaleString("en-US");
}

const FORMATTING_RULES =
  "Numbers given to you as 'N thousand' or 'N million' must be rendered abbreviated, never spelled out in full: " +
  "in English write 'N th' / 'N million' (e.g. '320.3 th', '7.4 million'); in Estonian write 'N tuh.' / 'N milj.' " +
  "with a comma decimal separator (e.g. '320,3 tuh.', '7,4 milj.'). Numbers given as 'Nx' (a multiplier, e.g. " +
  "'9.9x') must stay exactly as 'Nx' in both languages — never translate to words like 'times' or 'korda'.";

// ---- Dashboard (Ülevaade) + per-region variants -------------------------

async function computeDashboardMetrics() {
  const allCodes = ALL_REGIONS.map((r) => r.code);
  const guestData = await fetchTableData(
    MAJUTUS_PATH,
    "TU131.PX",
    [
      { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR", "OCC_NI"] } },
      { code: "Maakond", selection: { filter: "item", values: ["EE", ...allCodes] } },
      { code: "Elukohariik", selection: { filter: "item", values: ["WORLD", "EE", "FOR"] } },
      { code: "Vaatlusperiood", selection: { filter: "top", values: ["13"] } },
    ],
    { locale: "et" }
  );

  const byRegionPeriod = new Map();
  for (const row of flattenToRows(guestData)) {
    if (!byRegionPeriod.has(row.Maakond)) byRegionPeriod.set(row.Maakond, new Map());
    const periodMap = byRegionPeriod.get(row.Maakond);
    if (!periodMap.has(row.Vaatlusperiood)) {
      periodMap.set(row.Vaatlusperiood, { label: row.Vaatlusperiood_label });
    }
    periodMap.get(row.Vaatlusperiood)[`${row.Näitaja}_${row.Elukohariik}`] = row.value;
  }

  const nationalByPeriod = byRegionPeriod.get("EE");
  const periods = Array.from(nationalByPeriod.keys()).sort();
  const latestIdx = periods.length - 1;
  const nationalLatestGuests = nationalByPeriod.get(periods[latestIdx])?.OCC_ARR_WORLD ?? null;

  function metricsForRegion(regionCode) {
    const byPeriod = byRegionPeriod.get(regionCode);
    if (!byPeriod) return null;
    const latest = byPeriod.get(periods[latestIdx]) ?? {};
    const guestsSeries = periods.map((p) => byPeriod.get(p)?.OCC_ARR_WORLD ?? 0);
    const nightsSeries = periods.map((p) => byPeriod.get(p)?.OCC_NI_WORLD ?? 0);
    const avgNightsSeries = periods.map((p) => {
      const g = byPeriod.get(p)?.OCC_ARR_WORLD ?? 0;
      const n = byPeriod.get(p)?.OCC_NI_WORLD ?? 0;
      return g ? n / g : 0;
    });

    const totalGuests = latest.OCC_ARR_WORLD ?? 0;
    const totalNights = latest.OCC_NI_WORLD ?? 0;
    const domesticGuests = latest.OCC_ARR_EE ?? 0;
    const foreignGuests = latest.OCC_ARR_FOR ?? 0;
    const avgNightsPerGuest = totalGuests ? totalNights / totalGuests : 0;

    return {
      period: periods[latestIdx],
      periodLabel: latest.label,
      totalGuests,
      totalGuestsYoyPct: periodDelta(guestsSeries, latestIdx, 12),
      totalNights,
      totalNightsYoyPct: periodDelta(nightsSeries, latestIdx, 12),
      domesticGuests,
      foreignGuests,
      avgNightsPerGuest,
      avgNightsPerGuestYoyPct: periodDelta(avgNightsSeries, latestIdx, 12),
      shareOfNationalPct: nationalLatestGuests ? (totalGuests / nationalLatestGuests) * 100 : null,
    };
  }

  const national = metricsForRegion("EE");

  // Most-visited of the 15 real (non-overlapping) maakonds — cities are
  // excluded here since each is already counted inside its own maakond.
  let topCounty = null;
  for (const c of COUNTIES) {
    const m = metricsForRegion(c.code);
    if (m && (!topCounty || m.totalGuests > topCounty.value)) {
      topCounty = { label: c.et, value: m.totalGuests, yoyPct: m.totalGuestsYoyPct };
    }
  }

  const regions = {};
  for (const r of ALL_REGIONS) {
    regions[r.code] = metricsForRegion(r.code);
  }

  return { ...national, topCounty, regions };
}

function buildDashboardPrompt(m) {
  return `Dashboard / "Ülevaade" tab (source: Statistikaamet, table TU131) — national overview:
- Period: ${m.periodLabel}
- Total guests accommodated: ${abbrev(m.totalGuests)} (YoY: ${fmtPct(m.totalGuestsYoyPct)})
- Total nights spent: ${abbrev(m.totalNights)} (YoY: ${fmtPct(m.totalNightsYoyPct)})
- Domestic (Estonian resident) guests: ${abbrev(m.domesticGuests)}
- Foreign visitor guests: ${abbrev(m.foreignGuests)}
- Average nights per guest: ${m.avgNightsPerGuest.toFixed(2)} (YoY: ${fmtPct(m.avgNightsPerGuestYoyPct)})
${m.topCounty ? `- Most-visited county this period: ${m.topCounty.label}, ${abbrev(m.topCounty.value)} guests (YoY: ${fmtPct(m.topCounty.yoyPct)})` : ""}`;
}

// One prompt block per selectable region/city — grounds the region-specific
// dashboard blurb shown when a visitor picks that region in the dashboard's
// "Vali maakond" selector, replacing the national text above.
function buildRegionDashboardPrompt(region, m) {
  if (!m) return null;
  return `Region: ${region.et} (code: ${region.code})
- Period: ${m.periodLabel}
- Guests accommodated: ${abbrev(m.totalGuests)} (YoY: ${fmtPct(m.totalGuestsYoyPct)})
- Nights spent: ${abbrev(m.totalNights)} (YoY: ${fmtPct(m.totalNightsYoyPct)})
- Domestic vs foreign guests: ${abbrev(m.domesticGuests)} domestic, ${abbrev(m.foreignGuests)} foreign
- Average nights per guest: ${m.avgNightsPerGuest.toFixed(2)} (YoY: ${fmtPct(m.avgNightsPerGuestYoyPct)})
- Share of Estonia's total guests this period: ${m.shareOfNationalPct != null ? m.shareOfNationalPct.toFixed(1) + "%" : "n/a"}`;
}

// A compact ~10-year national guests-by-year series, used to draw a small
// native bar chart on page 1 of the PDF newsletter (see
// NewsletterPdfButton.jsx) — independent of any specific page's DOM, so
// it's always available regardless of which tab the reader has open when
// they generate the PDF.
async function computeNationalYearlyTrend() {
  const data = await fetchTableData(
    MAJUTUS_PATH,
    "TU131.PX",
    [
      { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
      { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
      { code: "Elukohariik", selection: { filter: "item", values: ["WORLD"] } },
      // 132 months (11 years) of headroom so the oldest calendar year in
      // the window is very likely complete once we take the last 10.
      { code: "Vaatlusperiood", selection: { filter: "top", values: ["132"] } },
    ],
    { locale: "et" }
  );

  const byYear = new Map();
  const monthsPerYear = new Map();
  for (const row of flattenToRows(data)) {
    if (row.value === null) continue;
    const year = row.Vaatlusperiood.split("M")[0];
    byYear.set(year, (byYear.get(year) ?? 0) + row.value);
    monthsPerYear.set(year, (monthsPerYear.get(year) ?? 0) + 1);
  }

  const years = Array.from(byYear.keys()).sort();
  // Drop a leading partial year (fewer than 12 months in the fetch window)
  // rather than showing it as a misleadingly short bar.
  if (years.length && monthsPerYear.get(years[0]) < 12) years.shift();

  return years.slice(-10).map((year) => ({ year, guests: byYear.get(year) }));
}

// ---- Map (Kaart ja hooajalisus) ----------------------------------------

async function computeMapMetrics(dashboard) {
  const countyCodes = COUNTIES.map((c) => c.code);
  const [countyData, originData] = await Promise.all([
    fetchTableData(
      MAJUTUS_PATH,
      "TU131.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_NI"] } },
        { code: "Maakond", selection: { filter: "item", values: countyCodes } },
        { code: "Elukohariik", selection: { filter: "item", values: ["WORLD"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["24"] } },
      ],
      { locale: "et" }
    ),
    fetchTableData(
      MAJUTUS_PATH,
      "TU131.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
        { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
        { code: "Elukohariik", selection: { filter: "item", values: ORIGIN_COUNTRY_CODES } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["12"] } },
      ],
      { locale: "et" }
    ),
  ]);

  const countyTotals = new Map();
  for (const row of flattenToRows(countyData)) {
    if (row.value === null) continue;
    const key = row.Maakond;
    countyTotals.set(key, { label: row.Maakond_label, value: (countyTotals.get(key)?.value ?? 0) + row.value });
  }
  let topCounty = null;
  for (const entry of countyTotals.values()) {
    if (!topCounty || entry.value > topCounty.value) topCounty = entry;
  }

  const originTotals = new Map();
  for (const row of flattenToRows(originData)) {
    if (row.value === null) continue;
    originTotals.set(row.Elukohariik, {
      label: row.Elukohariik_label,
      value: (originTotals.get(row.Elukohariik)?.value ?? 0) + row.value,
    });
  }
  let topOrigin = null;
  for (const entry of originTotals.values()) {
    if (!topOrigin || entry.value > topOrigin.value) topOrigin = entry;
  }

  return {
    windowMonths: 24,
    topCounty,
    topOrigin,
    domesticGuests: dashboard.domesticGuests,
    foreignGuests: dashboard.foreignGuests,
    periodLabel: dashboard.periodLabel,
  };
}

function buildMapPrompt(m) {
  return `Map & seasonality / "Kaart ja hooajalisus" tab (source: Statistikaamet, table TU131) — regional and origin breakdown:
- Most nights spent, summed over the last ${m.windowMonths} months: ${m.topCounty.label}, ${abbrev(m.topCounty.value)} nights
- Top foreign country of origin, last 12 months: ${m.topOrigin.label}, ${abbrev(m.topOrigin.value)} guests
- For context, the latest month (${m.periodLabel}) split: ${abbrev(m.domesticGuests)} domestic vs ${abbrev(m.foreignGuests)} foreign guests`;
}

// ---- Purpose & duration (Eesmärk ja kestus) -----------------------------

async function computePurposeMetrics() {
  const [purposeData, durationData] = await Promise.all([
    fetchTableData(
      MAJUTUS_PATH,
      "TU133.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_NI"] } },
        { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
        { code: "Reisi eesmärk", selection: { filter: "item", values: ["HOL", "BSNS", "BSNS_CONF", "BSNS_O", "_O"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["24"] } },
      ],
      { locale: "et" }
    ),
    fetchTableData(
      REISIMINE_PATH,
      "TU54.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["TR_DOM", "TR_OUT"] } },
        { code: "Reisi kestus", selection: { filter: "item", values: ["N1-3", "N4-7", "N_GT7"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
      ],
      { locale: "et" }
    ),
  ]);

  const purposeTotals = new Map();
  for (const row of flattenToRows(purposeData)) {
    if (row.value === null) continue;
    const name = row["Reisi eesmärk_label"];
    purposeTotals.set(name, (purposeTotals.get(name) ?? 0) + row.value);
  }
  const grandTotal = Array.from(purposeTotals.values()).reduce((a, b) => a + b, 0);
  let topPurpose = null;
  for (const [name, value] of purposeTotals) {
    if (!topPurpose || value > topPurpose.value) topPurpose = { name, value };
  }
  const topPurposeSharePct = topPurpose && grandTotal ? (topPurpose.value / grandTotal) * 100 : null;

  const durationTotals = new Map();
  let durationPeriodLabel = "";
  for (const row of flattenToRows(durationData)) {
    if (row.value === null) continue;
    durationPeriodLabel = row.Vaatlusperiood_label;
    const code = row["Reisi kestus"];
    durationTotals.set(code, (durationTotals.get(code) ?? 0) + row.value);
  }
  let topDuration = null;
  for (const [code, value] of durationTotals) {
    if (!topDuration || value > topDuration.value) topDuration = { label: DURATION_LABELS_ET[code], value };
  }

  return { windowMonths: 24, topPurpose, topPurposeSharePct, topDuration, durationPeriodLabel };
}

function buildPurposePrompt(m) {
  return `Purpose & duration / "Eesmärk ja kestus" tab (source: Statistikaamet, tables TU133 + TU54) — why and how long people stay:
- Dominant purpose of travel, nights spent over the last ${m.windowMonths} months: ${m.topPurpose.name}, ${m.topPurposeSharePct.toFixed(0)}% share of all nights
- Most common trip duration, ${m.durationPeriodLabel} (domestic + foreign trips combined): ${m.topDuration.label}, ${m.topDuration.value.toLocaleString("en-US")} thousand trips`;
}

// ---- Capacity (Mahutavus) ------------------------------------------------

async function computeCapacityMetrics() {
  const [trendData, occupancyData] = await Promise.all([
    fetchTableData(
      MAJUTUS_PATH,
      "TU11.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["CAP_BEDP"] } },
        { code: "Piirkond", selection: { filter: "item", values: ["EE"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["34"] } },
      ],
      { locale: "et" }
    ),
    fetchTableData(
      MAJUTUS_PATH,
      "TU110.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_OR_BEDP"] } },
        { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["1"] } },
      ],
      { locale: "et" }
    ),
  ]);

  const trendRows = flattenToRows(trendData)
    .map((r) => ({ label: r.Vaatlusperiood_label, value: r.value }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const firstCapacity = trendRows[0]?.value ?? null;
  const latestCapacity = trendRows[trendRows.length - 1]?.value ?? null;
  const latestCapacityLabel = trendRows[trendRows.length - 1]?.label ?? "";
  const growthMultiple = firstCapacity && latestCapacity ? latestCapacity / firstCapacity : null;

  const occupancyRow = flattenToRows(occupancyData)[0];

  return {
    latestCapacity,
    latestCapacityLabel,
    growthMultiple,
    occupancyPct: occupancyRow?.value ?? null,
    occupancyPeriodLabel: occupancyRow?.Vaatlusperiood_label ?? "",
  };
}

function buildCapacityPrompt(m) {
  return `Capacity / "Mahutavus" tab (source: Statistikaamet, tables TU11 + TU110) — accommodation supply nationally:
- Total beds available, ${m.latestCapacityLabel}: ${abbrev(m.latestCapacity)}${
    m.growthMultiple ? ` (${m.growthMultiple.toFixed(1)}x more than in 1992)` : ""
  }
${m.occupancyPct != null ? `- Bed occupancy rate, ${m.occupancyPeriodLabel}: ${m.occupancyPct.toFixed(1)}%` : ""}`;
}

// ---- Expenses (Reisikulutused) -------------------------------------------

async function computeExpensesMetrics() {
  const categoryData = await fetchTableData(
    REISIMINE_PATH,
    "TU552.px",
    [
      { code: "Näitaja", selection: { filter: "item", values: ["EXP", "EXP_TRA", "EXP_ACC", "EXP_REST", "EXP_OTH"] } },
      { code: "Kulu tüüp", selection: { filter: "item", values: ["AVG_EXP_TRP"] } },
      { code: "Reisi tüüp", selection: { filter: "item", values: ["DOM"] } },
      { code: "Vaatlusperiood", selection: { filter: "top", values: ["2"] } },
    ],
    { locale: "et" }
  );

  const byYear = new Map();
  for (const row of flattenToRows(categoryData)) {
    if (!byYear.has(row.Vaatlusperiood)) byYear.set(row.Vaatlusperiood, {});
    byYear.get(row.Vaatlusperiood)[row.Näitaja] = row.value;
  }
  const years = Array.from(byYear.keys()).sort();
  const latestYear = years[years.length - 1];
  const prevYear = years[years.length - 2];
  const latest = byYear.get(latestYear) ?? {};
  const prev = prevYear ? byYear.get(prevYear) : null;

  const avgPerTrip = latest.EXP ?? 0;
  const avgPerTripYoyPct = prev?.EXP ? ((avgPerTrip - prev.EXP) / prev.EXP) * 100 : null;

  let topCategory = null;
  for (const code of ["EXP_TRA", "EXP_ACC", "EXP_REST", "EXP_OTH"]) {
    const value = latest[code] ?? 0;
    if (!topCategory || value > topCategory.value) topCategory = { label: EXPENSE_CATEGORY_LABELS_ET[code], value };
  }

  return { latestYear, avgPerTrip, avgPerTripYoyPct, topCategory };
}

function buildExpensesPrompt(m) {
  return `Travel expenses / "Reisikulutused" tab (source: Statistikaamet, table TU552) — domestic trip spending, ${m.latestYear}:
- Average spend per domestic trip: €${m.avgPerTrip.toFixed(0)} (YoY: ${fmtPct(m.avgPerTripYoyPct)})
- Largest spending category: ${m.topCategory.label}, €${m.topCategory.value.toFixed(0)} average per trip`;
}

// ---- Claude calls -----------------------------------------------------------

// `highlight: true` adds a short one-sentence digest of the section, used
// by the PDF newsletter's compact "Muu statistika" block on page 1 instead
// of the full blurb (which stays only for the on-site scroll page).
function sectionSchema(description, { highlight = false } = {}) {
  const properties = {
    et: { type: "string", description: "80-150 word Estonian blurb." },
    en: { type: "string", description: "80-150 word English blurb." },
  };
  const required = ["et", "en"];
  if (highlight) {
    properties.highlightEt = {
      type: "string",
      description: "One punchy 20-25 word Estonian sentence distilling this section's single most important fact.",
    };
    properties.highlightEn = {
      type: "string",
      description: "One punchy 20-25 word English sentence, the same fact as highlightEt.",
    };
    required.push("highlightEt", "highlightEn");
  }
  return { type: "object", description, properties, required };
}

async function callClaude(anthropic, model, prompts) {
  const combinedPrompt = `Here is this period's data for five sections of an Estonian tourism statistics site ("Eesti Turism"). Write one short blurb per section using the emit_narrative tool.

${prompts.dashboard}

${prompts.map}

${prompts.purpose}

${prompts.capacity}

${prompts.expenses}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system:
      "You write short 'small text parts' for a personal Estonian tourism statistics site ('Eesti Turism'), " +
      "one per page section, meant to be read scrolling down like a newsletter. Ground every sentence strictly " +
      "in the numbers given for THAT section — never invent, round loosely, borrow a number from another " +
      "section, or speculate about causes not implied by the data. Each blurb is 80-150 words of plain prose " +
      "(no headings, no bullet points, no markdown), and should read as its own short item, not a continuation " +
      "of the previous section. Produce independently well-written Estonian and English versions of each " +
      "(not literal translations of each other, though they must report the same facts). Estonian must read " +
      "naturally to a native speaker. Avoid repeating the same opening phrase across sections. Four of the five " +
      "sections (all but dashboard) also need a short 'highlight' sentence — this is a compact digest for a " +
      "printed summary page, not a teaser for the full blurb, so it must stand alone and still make sense to " +
      "someone who never reads the full blurb. " + FORMATTING_RULES,
    messages: [{ role: "user", content: combinedPrompt }],
    tools: [
      {
        name: "emit_narrative",
        description: "Emit the finished blurb for every section, in both languages.",
        input_schema: {
          type: "object",
          properties: {
            dashboard: sectionSchema("Ülevaade (national overview) blurb"),
            map: sectionSchema("Kaart ja hooajalisus (map & seasonality) blurb", { highlight: true }),
            purpose: sectionSchema("Eesmärk ja kestus (purpose & duration) blurb", { highlight: true }),
            capacity: sectionSchema("Mahutavus (capacity) blurb", { highlight: true }),
            expenses: sectionSchema("Reisikulutused (travel expenses) blurb", { highlight: true }),
          },
          required: ["dashboard", "map", "purpose", "capacity", "expenses"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "emit_narrative" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a tool_use block");
  return normalizeSections(toolUse.input);
}

// Claude's tool-calling doesn't always respect a nested-object schema for
// every property in one call — observed in practice returning some
// sections as a real {et, en} object and others as a JSON-encoded STRING
// containing the same shape (e.g. "map": "{\"et\": ..., \"en\": ...}").
// Normalize defensively rather than trust the schema was followed exactly.
function normalizeSections(sections) {
  const normalized = {};
  for (const [key, value] of Object.entries(sections)) {
    normalized[key] = typeof value === "string" ? JSON.parse(value) : value;
  }
  return normalized;
}

// Separate call (own token budget) for the 18 region/city variants of the
// dashboard blurb — kept apart from callClaude's 5-section call so neither
// call's output risks truncating the other, and so a failure here doesn't
// cost the other four sections' already-generated text.
async function callClaudeRegions(anthropic, model, regions, promptBlocks) {
  const combinedPrompt =
    `Here is this period's per-region breakdown for the Ülevaade (dashboard) tab of "Eesti Turism". Write one ` +
    `short blurb per region using the emit_region_narrative tool — this text replaces the national overview text ` +
    `when a site visitor picks that specific region/city in the dashboard's region selector.\n\n` +
    promptBlocks.join("\n\n");

  const response = await anthropic.messages.create({
    model,
    max_tokens: 12000,
    system:
      "You write short region-specific blurbs for a personal Estonian tourism statistics site ('Eesti Turism'), " +
      "shown when a visitor picks a specific county or city in the dashboard's region selector, replacing the " +
      "national overview text. Ground every sentence strictly in the numbers given for THAT region — never " +
      "invent, round loosely, or borrow a number from another region. Each blurb is 60-100 words of plain prose " +
      "(no headings, no bullet points, no markdown). Produce independently well-written Estonian and English " +
      "versions of each (not literal translations of each other, though they must report the same facts). " +
      "Estonian must read naturally to a native speaker. Vary sentence structure across regions rather than " +
      "repeating the same template for every one. " + FORMATTING_RULES,
    messages: [{ role: "user", content: combinedPrompt }],
    tools: [
      {
        name: "emit_region_narrative",
        description: "Emit one blurb per region, in both languages, matching the exact region codes given.",
        input_schema: {
          type: "object",
          properties: {
            regions: {
              type: "array",
              description: "One entry per region, in the same order as given in the prompt.",
              items: {
                type: "object",
                properties: {
                  code: { type: "string", description: "The exact region code from the prompt, copied verbatim." },
                  et: { type: "string", description: "60-100 word Estonian blurb." },
                  en: { type: "string", description: "60-100 word English blurb." },
                },
                required: ["code", "et", "en"],
              },
              minItems: regions.length,
              maxItems: regions.length,
            },
          },
          required: ["regions"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "emit_region_narrative" },
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("Region narrative generation was truncated (hit max_tokens) — raise max_tokens and retry.");
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a tool_use block for regions");
  // Same defensive parsing as normalizeSections above — Claude's tool-calling
  // doesn't always respect the schema's array type, observed here returning
  // a JSON-encoded string instead in some runs.
  const list = typeof toolUse.input.regions === "string" ? JSON.parse(toolUse.input.regions) : toolUse.input.regions;
  if (!Array.isArray(list)) {
    throw new Error(`Region narrative tool call did not return an array: ${JSON.stringify(toolUse.input).slice(0, 300)}`);
  }

  const byCode = {};
  for (const entry of list) {
    byCode[entry.code] = { et: entry.et, en: entry.en };
  }
  return byCode;
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const force = process.argv.includes("--force");

  console.log("Fetching latest metrics from Statistikaamet…");
  const dashboard = await computeDashboardMetrics();
  console.log(`Latest period: ${dashboard.period} (${dashboard.periodLabel})`);

  const existing = await readExisting();
  if (!force && existing?.period === dashboard.period) {
    console.log(`narrative.json is already up to date for ${dashboard.period} — skipping (no API call made).`);
    return;
  }

  const [map, purpose, capacity, expenses, nationalYearlyGuests] = await Promise.all([
    computeMapMetrics(dashboard),
    computePurposeMetrics(),
    computeCapacityMetrics(),
    computeExpensesMetrics(),
    computeNationalYearlyTrend(),
  ]);

  const regionPromptBlocks = ALL_REGIONS.map((r) => buildRegionDashboardPrompt(r, dashboard.regions[r.code])).filter(
    Boolean
  );

  if (process.argv.includes("--debug-metrics")) {
    console.log(JSON.stringify({ dashboard, map, purpose, capacity, expenses, nationalYearlyGuests }, null, 2));
    console.log("--- prompts ---");
    console.log(buildDashboardPrompt(dashboard));
    console.log(buildMapPrompt(map));
    console.log(buildPurposePrompt(purpose));
    console.log(buildCapacityPrompt(capacity));
    console.log(buildExpensesPrompt(expenses));
    console.log("--- region prompts ---");
    console.log(regionPromptBlocks.join("\n\n"));
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  console.log("Calling Claude to generate all five section blurbs…");
  const sections = await callClaude(anthropic, model, {
    dashboard: buildDashboardPrompt(dashboard),
    map: buildMapPrompt(map),
    purpose: buildPurposePrompt(purpose),
    capacity: buildCapacityPrompt(capacity),
    expenses: buildExpensesPrompt(expenses),
  });

  console.log(`Calling Claude to generate ${ALL_REGIONS.length} region-specific dashboard blurbs…`);
  sections.dashboardByRegion = await callClaudeRegions(anthropic, model, ALL_REGIONS, regionPromptBlocks);
  sections.dashboard.nationalYearlyGuests = nationalYearlyGuests;

  const output = {
    generatedAt: new Date().toISOString(),
    period: dashboard.period,
    periodLabel: {
      et: dashboard.periodLabel,
      en: formatPeriodLabel(dashboard.period, null, "en"),
    },
    sections,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
