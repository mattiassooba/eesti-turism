// Generates the small AI-written "newsletter" blurbs shown under each
// scroll section (Ülevaade, Kaart ja hooajalisus, Eesmärk ja kestus,
// Mahutavus, Reisikulutused). Run standalone under Node (not the browser
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "..", "public", "data", "narrative.json");

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];
const REISIMINE_PATH = ["majandus", "turism-ja-majutus", "eesti-elanike-reisimine"];

// Same 15 non-overlapping maakonds every page's own topCounty logic uses
// ("EE" total + city sub-splits excluded to avoid double-counting).
const REAL_COUNTY_CODES = [
  "EE00370000000000",
  "EE00390000000000",
  "EE00450000000000",
  "EE00500000000000",
  "EE00520000000000",
  "EE00560000000000",
  "EE00600000000000",
  "EE00640000000000",
  "EE00680000000000",
  "EE00710000000000",
  "EE00740000000000",
  "EE00790000000000",
  "EE00810000000000",
  "EE00840000000000",
  "EE00870000000000",
];

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

// ---- Dashboard (Ülevaade) ----------------------------------------------

async function computeDashboardMetrics() {
  const [national, county] = await Promise.all([
    fetchTableData(
      MAJUTUS_PATH,
      "TU131.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR", "OCC_NI"] } },
        { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
        { code: "Elukohariik", selection: { filter: "item", values: ["WORLD", "EE", "FOR"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["13"] } },
      ],
      { locale: "et" }
    ),
    fetchTableData(
      MAJUTUS_PATH,
      "TU131.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
        { code: "Maakond", selection: { filter: "item", values: REAL_COUNTY_CODES } },
        { code: "Elukohariik", selection: { filter: "item", values: ["WORLD"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["13"] } },
      ],
      { locale: "et" }
    ),
  ]);

  const rows = flattenToRows(national);
  const byPeriod = new Map();
  for (const row of rows) {
    if (!byPeriod.has(row.Vaatlusperiood)) {
      byPeriod.set(row.Vaatlusperiood, { label: row.Vaatlusperiood_label });
    }
    byPeriod.get(row.Vaatlusperiood)[`${row.Näitaja}_${row.Elukohariik}`] = row.value;
  }
  const periods = Array.from(byPeriod.keys()).sort();
  const latestIdx = periods.length - 1;
  const latest = byPeriod.get(periods[latestIdx]);

  const guestsSeries = periods.map((p) => byPeriod.get(p).OCC_ARR_WORLD ?? 0);
  const nightsSeries = periods.map((p) => byPeriod.get(p).OCC_NI_WORLD ?? 0);
  const avgNightsSeries = periods.map((p) => {
    const g = byPeriod.get(p).OCC_ARR_WORLD ?? 0;
    const n = byPeriod.get(p).OCC_NI_WORLD ?? 0;
    return g ? n / g : 0;
  });

  const totalGuests = latest.OCC_ARR_WORLD ?? 0;
  const totalNights = latest.OCC_NI_WORLD ?? 0;
  const domesticGuests = latest.OCC_ARR_EE ?? 0;
  const foreignGuests = latest.OCC_ARR_FOR ?? 0;
  const avgNightsPerGuest = totalGuests ? totalNights / totalGuests : 0;

  const countyRows = flattenToRows(county);
  const countyByPeriod = new Map();
  for (const row of countyRows) {
    if (!countyByPeriod.has(row.Vaatlusperiood)) countyByPeriod.set(row.Vaatlusperiood, new Map());
    countyByPeriod.get(row.Vaatlusperiood).set(row.Maakond, row.value);
  }
  let topCounty = null;
  for (const row of countyRows) {
    if (row.Vaatlusperiood !== periods[latestIdx] || row.value === null) continue;
    if (!topCounty || row.value > topCounty.value) {
      topCounty = { code: row.Maakond, label: row.Maakond_label, value: row.value };
    }
  }
  const topCountySeries = periods.map((p) => countyByPeriod.get(p)?.get(topCounty?.code) ?? 0);

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
    topCounty: topCounty
      ? { label: topCounty.label, value: topCounty.value, yoyPct: periodDelta(topCountySeries, latestIdx, 12) }
      : null,
  };
}

function buildDashboardPrompt(m) {
  return `Dashboard / "Ülevaade" tab (source: Statistikaamet, table TU131) — national overview:
- Period: ${m.periodLabel}
- Total guests accommodated: ${m.totalGuests.toLocaleString("en-US")} (YoY: ${fmtPct(m.totalGuestsYoyPct)})
- Total nights spent: ${m.totalNights.toLocaleString("en-US")} (YoY: ${fmtPct(m.totalNightsYoyPct)})
- Domestic (Estonian resident) guests: ${m.domesticGuests.toLocaleString("en-US")}
- Foreign visitor guests: ${m.foreignGuests.toLocaleString("en-US")}
- Average nights per guest: ${m.avgNightsPerGuest.toFixed(2)} (YoY: ${fmtPct(m.avgNightsPerGuestYoyPct)})
${m.topCounty ? `- Most-visited county this period: ${m.topCounty.label}, ${m.topCounty.value.toLocaleString("en-US")} guests (YoY: ${fmtPct(m.topCounty.yoyPct)})` : ""}`;
}

// ---- Map (Kaart ja hooajalisus) ----------------------------------------

async function computeMapMetrics(dashboard) {
  const [countyData, originData] = await Promise.all([
    fetchTableData(
      MAJUTUS_PATH,
      "TU131.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_NI"] } },
        { code: "Maakond", selection: { filter: "item", values: REAL_COUNTY_CODES } },
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
- Most nights spent, summed over the last ${m.windowMonths} months: ${m.topCounty.label}, ${m.topCounty.value.toLocaleString("en-US")} nights
- Top foreign country of origin, last 12 months: ${m.topOrigin.label}, ${m.topOrigin.value.toLocaleString("en-US")} guests
- For context, the latest month (${m.periodLabel}) split: ${m.domesticGuests.toLocaleString("en-US")} domestic vs ${m.foreignGuests.toLocaleString("en-US")} foreign guests`;
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
- Total beds available, ${m.latestCapacityLabel}: ${m.latestCapacity.toLocaleString("en-US")}${
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

// ---- Claude call ----------------------------------------------------------

function sectionSchema(description) {
  return {
    type: "object",
    description,
    properties: {
      et: { type: "string", description: "80-150 word Estonian blurb." },
      en: { type: "string", description: "80-150 word English blurb." },
    },
    required: ["et", "en"],
  };
}

async function callClaude(prompts) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

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
      "naturally to a native speaker. Avoid repeating the same opening phrase across sections.",
    messages: [{ role: "user", content: combinedPrompt }],
    tools: [
      {
        name: "emit_narrative",
        description: "Emit the finished blurb for every section, in both languages.",
        input_schema: {
          type: "object",
          properties: {
            dashboard: sectionSchema("Ülevaade (national overview) blurb"),
            map: sectionSchema("Kaart ja hooajalisus (map & seasonality) blurb"),
            purpose: sectionSchema("Eesmärk ja kestus (purpose & duration) blurb"),
            capacity: sectionSchema("Mahutavus (capacity) blurb"),
            expenses: sectionSchema("Reisikulutused (travel expenses) blurb"),
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

  const [map, purpose, capacity, expenses] = await Promise.all([
    computeMapMetrics(dashboard),
    computePurposeMetrics(),
    computeCapacityMetrics(),
    computeExpensesMetrics(),
  ]);

  if (process.argv.includes("--debug-metrics")) {
    console.log(JSON.stringify({ map, purpose, capacity, expenses }, null, 2));
    console.log("--- prompts ---");
    console.log(buildMapPrompt(map));
    console.log(buildPurposePrompt(purpose));
    console.log(buildCapacityPrompt(capacity));
    console.log(buildExpensesPrompt(expenses));
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  console.log("Calling Claude to generate all five section blurbs…");
  const sections = await callClaude({
    dashboard: buildDashboardPrompt(dashboard),
    map: buildMapPrompt(map),
    purpose: buildPurposePrompt(purpose),
    capacity: buildCapacityPrompt(capacity),
    expenses: buildExpensesPrompt(expenses),
  });

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
