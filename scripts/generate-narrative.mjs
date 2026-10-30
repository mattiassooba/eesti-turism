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
import { detectFindings, rankFindings, findingsByRegionCode } from "./lib/findings.mjs";
import { runPrePublishChecks } from "./lib/qa.mjs";
import { ytdFigures, sectorFigures } from "./narrativeYtd.mjs";
import { assertComplete, requireSector, normalizeSections } from "./lib/guards.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "..", "public", "data", "narrative.json");

const MAJUTUS_PATH = ["majandus", "turism-ja-majutus", "majutus"];
const REISIMINE_PATH = ["majandus", "turism-ja-majutus", "eesti-elanike-reisimine"];
const TURISM_MAJANDUS_PATH = ["majandus", "turism-ja-majutus", "turismi-ja-majutuse-majandusnaitajad"];

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
      // 24 months — enough to cover the full year-to-date cumulative
      // comparison (Jan through the latest month, this year vs last),
      // regardless of which calendar month is latest.
      { code: "Vaatlusperiood", selection: { filter: "top", values: ["24"] } },
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

  const [latestYearStr, latestMonthStr] = periods[latestIdx].split("M");
  const cumulativePeriodsThisYear = periods.filter(
    (p) => p.startsWith(latestYearStr) && p.split("M")[1] <= latestMonthStr
  );
  const cumulativePeriodsPrevYear = periods.filter(
    (p) => p.startsWith(String(Number(latestYearStr) - 1)) && p.split("M")[1] <= latestMonthStr
  );

  function metricsForRegion(regionCode) {
    const byPeriod = byRegionPeriod.get(regionCode);
    if (!byPeriod) return null;
    const latest = byPeriod.get(periods[latestIdx]) ?? {};
    const guestsSeries = periods.map((p) => byPeriod.get(p)?.OCC_ARR_WORLD ?? 0);
    const nightsSeries = periods.map((p) => byPeriod.get(p)?.OCC_NI_WORLD ?? 0);
    const domesticGuestsSeries = periods.map((p) => byPeriod.get(p)?.OCC_ARR_EE ?? 0);
    const foreignGuestsSeries = periods.map((p) => byPeriod.get(p)?.OCC_ARR_FOR ?? 0);
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

    // Year-to-date: Jan through the latest month, this year vs. the same
    // Jan-through-month window last year — a single month's YoY doesn't
    // say how the year as a whole is tracking.
    const sumField = (periodsList) =>
      periodsList.reduce((acc, p) => acc + (byPeriod.get(p)?.OCC_ARR_WORLD ?? 0), 0);
    const cumulativeGuests = sumField(cumulativePeriodsThisYear);
    const cumulativeGuestsPrev = sumField(cumulativePeriodsPrevYear);

    return {
      period: periods[latestIdx],
      periodLabel: latest.label,
      totalGuests,
      totalGuestsYoyPct: periodDelta(guestsSeries, latestIdx, 12),
      totalNights,
      totalNightsYoyPct: periodDelta(nightsSeries, latestIdx, 12),
      domesticGuests,
      domesticGuestsYoyPct: periodDelta(domesticGuestsSeries, latestIdx, 12),
      foreignGuests,
      foreignGuestsYoyPct: periodDelta(foreignGuestsSeries, latestIdx, 12),
      avgNightsPerGuest,
      avgNightsPerGuestYoyPct: periodDelta(avgNightsSeries, latestIdx, 12),
      shareOfNationalPct: nationalLatestGuests ? (totalGuests / nationalLatestGuests) * 100 : null,
      cumulativeGuests,
      cumulativeGuestsYoyPct: cumulativeGuestsPrev
        ? ((cumulativeGuests - cumulativeGuestsPrev) / cumulativeGuestsPrev) * 100
        : null,
      // Guests, nights, domestic and foreign for Jan–latest month; the texts
      // lead with these (see the YTD rule in the system prompts).
      ytd: ytdFigures(byPeriod, periods, periods[latestIdx]),
    };
  }

  const national = metricsForRegion("EE");

  // Most-visited of the 15 real (non-overlapping) maakonds — cities are
  // excluded here since each is already counted inside its own maakond.
  let topCounty = null;
  for (const c of COUNTIES) {
    const m = metricsForRegion(c.code);
    if (m && (!topCounty || m.totalGuests > topCounty.value)) {
      topCounty = { code: c.code, label: c.et, value: m.totalGuests, yoyPct: m.totalGuestsYoyPct };
    }
  }

  const regions = {};
  for (const r of ALL_REGIONS) {
    regions[r.code] = metricsForRegion(r.code);
  }

  return { ...national, topCounty, regions };
}

const EN_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function cumulativeRangeLabel(period) {
  const [year, month] = period.split("M");
  return `Jan–${EN_MONTH_ABBR[Number(month) - 1]} ${year}`;
}

// Year-to-date block, listed first in the dashboard and region prompts:
// the texts lead with how the year is going, not the single latest month.
function ytdLines(m) {
  const y = m.ytd;
  if (!y) return "";
  return `- YEAR TO DATE, ${cumulativeRangeLabel(m.period)} (lead with these; changes are vs. the same months last year):
  - Guests accommodated: ${abbrev(y.guests)} (${fmtPct(y.guestsYoyPct)})
  - Nights spent: ${abbrev(y.nights)} (${fmtPct(y.nightsYoyPct)})
  - Domestic guests: ${abbrev(y.domestic)} (${fmtPct(y.domesticYoyPct)}); foreign guests: ${abbrev(y.foreign)} (${fmtPct(y.foreignYoyPct)})`;
}

function buildDashboardPrompt(m) {
  return `Dashboard / "Ülevaade" tab (source: Statistikaamet, table TU131) — national overview:
${ytdLines(m)}
- LATEST MONTH, ${m.periodLabel} (secondary; changes are vs. the same month last year):
  - Total guests accommodated: ${abbrev(m.totalGuests)} (YoY: ${fmtPct(m.totalGuestsYoyPct)})
  - Total nights spent: ${abbrev(m.totalNights)} (YoY: ${fmtPct(m.totalNightsYoyPct)})
  - Domestic (Estonian resident) guests: ${abbrev(m.domesticGuests)}
  - Foreign visitor guests: ${abbrev(m.foreignGuests)}
  - Average nights per guest: ${m.avgNightsPerGuest.toFixed(2)} (YoY: ${fmtPct(m.avgNightsPerGuestYoyPct)})
${m.topCounty ? `  - Most-visited county this month: ${m.topCounty.label}, ${abbrev(m.topCounty.value)} guests (YoY: ${fmtPct(m.topCounty.yoyPct)})` : ""}`;
}

// One prompt block per selectable region/city — grounds the region-specific
// dashboard blurb shown when a visitor picks that region in the dashboard's
// "Vali maakond" selector, replacing the national text above.
function buildRegionDashboardPrompt(region, m, divergenceFinding) {
  if (!m) return null;
  return `Region: ${region.et} (code: ${region.code})
${ytdLines(m)}
- LATEST MONTH, ${m.periodLabel} (secondary; changes are vs. the same month last year):
  - Guests accommodated: ${abbrev(m.totalGuests)} (YoY: ${fmtPct(m.totalGuestsYoyPct)})
  - Nights spent: ${abbrev(m.totalNights)} (YoY: ${fmtPct(m.totalNightsYoyPct)})
  - Domestic vs foreign guests: ${abbrev(m.domesticGuests)} domestic, ${fmtPct(m.domesticGuestsYoyPct)} YoY; ${abbrev(m.foreignGuests)} foreign, ${fmtPct(m.foreignGuestsYoyPct)} YoY
  - Average nights per guest: ${m.avgNightsPerGuest.toFixed(2)} (YoY: ${fmtPct(m.avgNightsPerGuestYoyPct)})
  - Share of Estonia's total guests this month: ${m.shareOfNationalPct != null ? m.shareOfNationalPct.toFixed(1) + "%" : "n/a"}${
    divergenceFinding ? `\n- Pre-verified noteworthy contrast for this region: ${divergenceFinding.text}` : ""
  }`;
}

// A compact ~10-year national residents-vs-foreign-visitors series, used
// to draw a small native stacked-bar chart on page 1 of the PDF newsletter
// (see NewsletterPdfButton.jsx) — independent of any specific page's DOM,
// so it's always available regardless of which tab the reader has open
// when they generate the PDF.
async function computeNationalYearlyTrend() {
  const data = await fetchTableData(
    MAJUTUS_PATH,
    "TU131.PX",
    [
      { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
      { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
      { code: "Elukohariik", selection: { filter: "item", values: ["EE", "FOR"] } },
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
    if (!byYear.has(year)) byYear.set(year, { domestic: 0, foreign: 0 });
    const bucket = byYear.get(year);
    if (row.Elukohariik === "EE") bucket.domestic += row.value;
    else if (row.Elukohariik === "FOR") bucket.foreign += row.value;
    monthsPerYear.set(year, (monthsPerYear.get(year) ?? 0) + 1);
  }

  const years = Array.from(byYear.keys()).sort();
  // Drop a leading partial year (fewer than 12 months in the fetch window,
  // counting distinct months across both residency series) rather than
  // showing it as a misleadingly short bar.
  if (years.length && monthsPerYear.get(years[0]) < 24) years.shift();

  // The trailing (current) year is very often partial too — e.g. a report
  // generated in August only has Jan-Aug for this year, but a full 12
  // months for every prior year. Unlike the leading year, this one isn't
  // dropped (its guests-so-far figure is useful context), but it's flagged
  // so the PDF chart can mark it visually instead of silently drawing a
  // short bar next to full-year bars.
  return years.slice(-10).map((year) => ({
    year,
    ...byYear.get(year),
    partial: (monthsPerYear.get(year) ?? 0) < 24,
  }));
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
    // 24 months, not 12 — split into the latest 12 (topOrigin, as before)
    // and the 12 before that, so a YoY change per source market can be
    // computed instead of only a point-in-time ranking.
    fetchTableData(
      MAJUTUS_PATH,
      "TU131.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_ARR"] } },
        { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
        { code: "Elukohariik", selection: { filter: "item", values: ORIGIN_COUNTRY_CODES } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["24"] } },
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

  const originRows = flattenToRows(originData).filter((r) => r.value !== null);
  const originPeriods = Array.from(new Set(originRows.map((r) => r.Vaatlusperiood))).sort();
  const recentOriginPeriods = new Set(originPeriods.slice(-12));
  const priorOriginPeriods = new Set(originPeriods.slice(0, -12));

  function sumByOrigin(periodSet) {
    const totals = new Map();
    for (const row of originRows) {
      if (!periodSet.has(row.Vaatlusperiood)) continue;
      const prev = totals.get(row.Elukohariik);
      totals.set(row.Elukohariik, {
        label: row.Elukohariik_label,
        value: (prev?.value ?? 0) + row.value,
      });
    }
    return totals;
  }

  const originTotals = sumByOrigin(recentOriginPeriods);
  const originTotalsPrev = priorOriginPeriods.size ? sumByOrigin(priorOriginPeriods) : null;

  let topOrigin = null;
  for (const entry of originTotals.values()) {
    if (!topOrigin || entry.value > topOrigin.value) topOrigin = entry;
  }

  // The biggest YoY mover among source markets big enough to matter (at
  // least 3% of the latest-12-months foreign total) — a market going from
  // 40 to 80 guests is a "100% increase" that means nothing at national
  // scale, so it's excluded by this floor rather than surfaced as news.
  let topOriginMover = null;
  if (originTotalsPrev) {
    const grandTotal = Array.from(originTotals.values()).reduce((a, b) => a + b.value, 0);
    const minBase = grandTotal * 0.03;
    for (const [code, entry] of originTotals) {
      const prevEntry = originTotalsPrev.get(code);
      if (!prevEntry || entry.value < minBase || prevEntry.value < minBase) continue;
      const pct = ((entry.value - prevEntry.value) / prevEntry.value) * 100;
      if (!topOriginMover || Math.abs(pct) > Math.abs(topOriginMover.pct)) {
        topOriginMover = { label: entry.label, value: entry.value, prevValue: prevEntry.value, pct };
      }
    }
  }

  return {
    windowMonths: 24,
    topCounty,
    topOrigin,
    topOriginMover,
    domesticGuests: dashboard.domesticGuests,
    foreignGuests: dashboard.foreignGuests,
    periodLabel: dashboard.periodLabel,
  };
}

function buildMapPrompt(m) {
  return `Map & seasonality / "Kaart ja hooajalisus" tab (source: Statistikaamet, table TU131) — regional and origin breakdown:
- Most nights spent, summed over the last ${m.windowMonths} months: ${m.topCounty.label}, ${abbrev(m.topCounty.value)} nights
- Top foreign country of origin, last 12 months: ${m.topOrigin.label}, ${abbrev(m.topOrigin.value)} guests
- For context, the latest month (${m.periodLabel}) split: ${abbrev(m.domesticGuests)} domestic vs ${abbrev(m.foreignGuests)} foreign guests${
    m.topOriginMover
      ? `\n- Biggest YoY mover among source markets (latest 12 months vs. the 12 before): ${m.topOriginMover.label}, ${fmtPct(m.topOriginMover.pct)} (${abbrev(m.topOriginMover.prevValue)} to ${abbrev(m.topOriginMover.value)} guests)`
      : ""
  }`;
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
  const [trendData, occPriceData] = await Promise.all([
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
    // 13 months (latest + same month last year) so occupancy and price can
    // report a real YoY change, not just a point-in-time snapshot.
    fetchTableData(
      MAJUTUS_PATH,
      "TU110.PX",
      [
        { code: "Näitaja", selection: { filter: "item", values: ["OCC_OR_BEDP", "OCC_NI_COST"] } },
        { code: "Maakond", selection: { filter: "item", values: ["EE"] } },
        { code: "Vaatlusperiood", selection: { filter: "top", values: ["13"] } },
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

  const occPriceRows = flattenToRows(occPriceData).filter((r) => r.value !== null);
  const byPeriod = new Map();
  for (const row of occPriceRows) {
    if (!byPeriod.has(row.Vaatlusperiood)) byPeriod.set(row.Vaatlusperiood, { label: row.Vaatlusperiood_label });
    byPeriod.get(row.Vaatlusperiood)[row.Näitaja] = row.value;
  }
  const occPeriods = Array.from(byPeriod.keys()).sort();
  const latestPeriod = occPeriods[occPeriods.length - 1];
  const priorYearPeriod = occPeriods.find((p) => {
    const [y, m] = p.split("M");
    const [ly, lm] = latestPeriod.split("M");
    return y === String(Number(ly) - 1) && m === lm;
  });
  const latestRow = byPeriod.get(latestPeriod) ?? {};
  const priorYearRow = priorYearPeriod ? byPeriod.get(priorYearPeriod) : null;

  const occupancyPct = latestRow.OCC_OR_BEDP ?? null;
  const occupancyPctPrev = priorYearRow?.OCC_OR_BEDP ?? null;
  const avgNightCost = latestRow.OCC_NI_COST ?? null;
  const avgNightCostPrev = priorYearRow?.OCC_NI_COST ?? null;

  return {
    latestCapacity,
    latestCapacityLabel,
    growthMultiple,
    occupancyPct,
    occupancyPeriodLabel: latestRow.label ?? "",
    occupancyPctYoy: yoyDelta(occupancyPct, occupancyPctPrev),
    avgNightCost,
    avgNightCostYoyPct: percentDelta(avgNightCost, avgNightCostPrev),
  };
}

// Plain point difference (percentage POINTS), for rate-type indicators
// (occupancy) where a relative % change would misstate a move like
// "72% to 71%" as a scary-sounding "-1.4%" instead of "-1 point".
function yoyDelta(current, prior) {
  if (current == null || prior == null) return null;
  return current - prior;
}
function percentDelta(current, prior) {
  if (current == null || prior == null || prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

function buildCapacityPrompt(m) {
  return `Capacity / "Mahutavus" tab (source: Statistikaamet, tables TU11 + TU110) — accommodation supply nationally:
- Total beds available, ${m.latestCapacityLabel}: ${abbrev(m.latestCapacity)}${
    m.growthMultiple ? ` (${m.growthMultiple.toFixed(1)}x more than in 1992)` : ""
  }
${
  m.occupancyPct != null
    ? `- Bed occupancy rate, ${m.occupancyPeriodLabel}: ${m.occupancyPct.toFixed(1)}%${
        m.occupancyPctYoy != null ? ` (${m.occupancyPctYoy >= 0 ? "+" : ""}${m.occupancyPctYoy.toFixed(1)} points YoY)` : ""
      }`
    : ""
}
${
  m.avgNightCost != null
    ? `- Average cost per night nationally, ${m.occupancyPeriodLabel}: €${m.avgNightCost.toFixed(0)} (YoY: ${fmtPct(m.avgNightCostYoyPct)})`
    : ""
}`;
}

// Per-county occupancy and price, each with a real YoY — one call for all
// 15 maakonds (counties only; cities are each a subset of their own county,
// so including them would double-count). This is what lets a finding like
// "guests up 9%, but occupancy down a point and price down 10%" exist for
// ANY county, not just the one the national Capacity section already
// covers — exactly the kind of cross-metric contrast Task 2.1 asks for.
async function computeRegionalOccupancyPrice() {
  const countyCodes = COUNTIES.map((c) => c.code);
  const data = await fetchTableData(
    MAJUTUS_PATH,
    "TU110.PX",
    [
      { code: "Näitaja", selection: { filter: "item", values: ["OCC_OR_BEDP", "OCC_NI_COST"] } },
      { code: "Maakond", selection: { filter: "item", values: countyCodes } },
      { code: "Vaatlusperiood", selection: { filter: "top", values: ["13"] } },
    ],
    { locale: "et" }
  );

  const byRegionPeriod = new Map();
  for (const row of flattenToRows(data)) {
    if (row.value === null) continue;
    if (!byRegionPeriod.has(row.Maakond)) byRegionPeriod.set(row.Maakond, new Map());
    const periodMap = byRegionPeriod.get(row.Maakond);
    if (!periodMap.has(row.Vaatlusperiood)) {
      periodMap.set(row.Vaatlusperiood, { label: row.Vaatlusperiood_label });
    }
    periodMap.get(row.Vaatlusperiood)[row.Näitaja] = row.value;
  }

  const result = {};
  for (const code of countyCodes) {
    const periodMap = byRegionPeriod.get(code);
    if (!periodMap) continue;
    const regionPeriods = Array.from(periodMap.keys()).sort();
    const latestPeriod = regionPeriods[regionPeriods.length - 1];
    if (!latestPeriod) continue;
    const [ly, lm] = latestPeriod.split("M");
    const priorYearPeriod = regionPeriods.find((p) => {
      const [y, m] = p.split("M");
      return y === String(Number(ly) - 1) && m === lm;
    });
    const latestRow = periodMap.get(latestPeriod) ?? {};
    const priorYearRow = priorYearPeriod ? periodMap.get(priorYearPeriod) : null;
    result[code] = {
      period: latestPeriod,
      occupancyPct: latestRow.OCC_OR_BEDP ?? null,
      occupancyPctYoy: yoyDelta(latestRow.OCC_OR_BEDP, priorYearRow?.OCC_OR_BEDP),
      avgNightCost: latestRow.OCC_NI_COST ?? null,
      avgNightCostYoyPct: percentDelta(latestRow.OCC_NI_COST, priorYearRow?.OCC_NI_COST),
    };
  }
  return result;
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

// ---- Accommodation sector economy (TU410) ------------------------------------

// Same query as the site's useSector (prototype/src/data/datasets.js).
async function computeSectorMetrics() {
  const data = await fetchTableData(
    TURISM_MAJANDUS_PATH,
    "TU410.PX",
    [
      { code: "Näitaja", selection: { filter: "item", values: ["CUB_SERV"] } },
      { code: "Teenuse liik", selection: { filter: "item", values: ["I55"] } },
      { code: "Vaatlusperiood", selection: { filter: "top", values: ["12"] } },
    ],
    { locale: "et" }
  );
  return requireSector(sectorFigures(flattenToRows(data)));
}

function buildSectorPrompt(m) {
  if (!m) return "";
  return `Accommodation sector economy / "Majutussektori majandus" (source: Statistikaamet, table TU410) — accommodation services turnover (I55), quarterly:
- Latest quarter ${m.latestQuarterLabel ?? m.latestQuarter}: turnover €${m.turnoverMeur.toFixed(1)} million (vs. the same quarter a year earlier: ${fmtPct(m.yoyPct)})
- Change vs. the same quarter a year earlier, last four quarters: ${m.lastFour.map((q) => `${q.period} ${fmtPct(q.pct)}`).join("; ")}
- These are nominal (current-price) figures; do not call them profit.`;
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

// The exact cliché phrases this site's own earlier output has leaned on —
// named explicitly rather than just "avoid clichés" in the abstract, since
// a model asked to avoid unspecified clichés tends to reach for different
// (but equally generic) ones instead.
const BANNED_PHRASES_ET = [
  "mis näitab, et",
  "püsib kindla vedurina",
  "tugev rahvusvaheline tõmme",
  "joonistab selge pildi",
  "kindel vedur",
];

async function callClaude(anthropic, model, prompts, findings) {
  const findingsBlock = findings.length
    ? `Pre-verified, ranked findings for this period (computed in code, not by you — these are the facts most worth leading with; weave the relevant ones into the matching section below in your own words, but do not alter the numbers, invent additional comparisons, or claim a cause for any of them):\n${findings
        .map((f, i) => `${i + 1}. [${f.category}] ${f.text}`)
        .join("\n")}`
    : "";

  const combinedPrompt = `Here is this period's data for six sections of an Estonian tourism statistics site ("Eesti Turism"). Write one short blurb per section using the emit_narrative tool.

${findingsBlock}

${prompts.dashboard}

${prompts.map}

${prompts.purpose}

${prompts.capacity}

${prompts.expenses}

${prompts.sector}`;

  const response = await anthropic.messages.create({
    model,
    // Six sections (each et + en, five with highlights) plus headline and
    // insights; 4096 was close to the edge once the sector section was added.
    max_tokens: 8192,
    system:
      "You write short 'small text parts' for a personal Estonian tourism statistics site ('Eesti Turism'), " +
      "one per page section, meant to be read scrolling down like a newsletter. Ground every sentence strictly " +
      "in the numbers given for THAT section, and in the ranked findings list where relevant — never invent, " +
      "round loosely, borrow a number from another section, or speculate about causes not implied by the data. " +
      "Each blurb is 80-150 words of plain prose (no headings, no bullet points, no markdown), and should read " +
      "as its own short item, not a continuation of the previous section. Produce independently well-written " +
      "Estonian and English versions of each (not literal translations of each other, though they must report " +
      "the same facts). Estonian must read naturally to a native speaker. Avoid repeating the same opening " +
      "phrase across sections.\n\n" +
      "ACCURACY RULES (apply to every blurb and highlight):\n" +
      "- Never describe a trend as 'stable', 'consistent', 'steady', or similar unless the data given actually " +
      "shows multiple periods moving the same direction — a single period's number is not a trend.\n" +
      "- Never state or imply a cause for a change (no 'because', 'driven by', 'thanks to', 'due to') unless a " +
      "cause is explicitly given in the data — report what changed, not why, when the why isn't given.\n" +
      "- Never make a profitability, revenue, or business-performance claim from occupancy or price data alone " +
      "— those describe activity and cost, not profit.\n" +
      "- Never add a subjective qualifier to a number ('only', 'just', 'merely', 'a mere') unless the data block " +
      "itself gives you the context that justifies it (e.g. an explicit comparison point).\n" +
      "- Keep facts and any framing visibly separate: state the number and its comparison first, in plain terms, " +
      "before any characterization of what it means.\n" +
      `- Never use these exact phrases or close paraphrases of them, in Estonian or English: ${BANNED_PHRASES_ET.join("; ")}.\n\n` +
      "You also owe two things beyond the six section blurbs, both read directly from the ranked findings list " +
      "above, not independently chosen: a one-sentence 'headline' restating the #1 ranked finding (this becomes " +
      "the PDF report's main header — it must be the single most important development, not a generic summary " +
      "like 'tourism statistics updated'), and exactly 3 'keyInsights' sentences pulled from elsewhere in the " +
      "ranked list, favoring the most interesting contrasts over restating single numbers the KPI cards already " +
      "show.\n\n" +
      "Five of the six sections (all but dashboard) also need a short 'highlight' sentence — this is a compact " +
      "digest for a printed monthly newsletter page, not a teaser for the full blurb, so it must stand alone and " +
      "still make sense to someone who never reads the full blurb. The highlight must lead with the most recent " +
      "year-over-year comparison available (this year vs. last year) and must NOT reference distant historical " +
      "baselines (e.g. growth multiples since a decades-old base year like 1992) — that kind of long-horizon " +
      "framing belongs only in the full blurb, never the highlight, since a monthly reader cares about what " +
      "changed recently, not multi-decade trends. The dashboard blurb must LEAD with the year-to-date period " +
      "(January through the latest month, e.g. 'jaanuarist augustini'): accommodated guests, nights, and " +
      "domestic vs foreign guests, each with its change versus the same months last year. Only after that, " +
      "briefly, the latest single month. The sector blurb reports the latest quarter's accommodation services " +
      "turnover and its change versus the same quarter a year earlier, plus how the last four quarters moved; " +
      "it is nominal turnover, never profit. " +
      FORMATTING_RULES,
    messages: [{ role: "user", content: combinedPrompt }],
    tools: [
      {
        name: "emit_narrative",
        description: "Emit the finished blurb for every section, in both languages.",
        input_schema: {
          type: "object",
          properties: {
            headline: {
              type: "object",
              description:
                "One bold, punchy sentence (not a paragraph) for the PDF report's main header, stating the single " +
                "most important development this period. Must restate the #1 ranked finding given above in plain " +
                "language — do not pick a different fact than the top-ranked one.",
              properties: {
                et: { type: "string", description: "One Estonian sentence, 8-18 words, e.g. 'Eestis majutatud turistide arv kasvas augustis 4,9%.'" },
                en: { type: "string", description: "The same fact in English, 8-18 words." },
              },
              required: ["et", "en"],
            },
            keyInsights: {
              type: "array",
              description:
                "Exactly 3 standalone one-sentence insights for the PDF's 'Key insights' section, each its own " +
                "complete sentence (not a KPI restatement — those are already on the report as cards). Choose the " +
                "3 most interesting items from the ranked findings list above, preferring contrasts and gaps " +
                "(e.g. visitor growth vs. occupancy moving opposite ways) over single numbers alone, and prefer " +
                "variety (don't pick 3 findings about the same region or metric if better options exist).",
              items: {
                type: "object",
                properties: {
                  et: { type: "string", description: "One Estonian sentence, 15-30 words." },
                  en: { type: "string", description: "The same fact in English, 15-30 words." },
                },
                required: ["et", "en"],
              },
              minItems: 3,
              maxItems: 3,
            },
            dashboard: sectionSchema("Ülevaade (national overview) blurb"),
            map: sectionSchema("Kaart ja hooajalisus (map & seasonality) blurb", { highlight: true }),
            purpose: sectionSchema("Eesmärk ja kestus (purpose & duration) blurb", { highlight: true }),
            capacity: sectionSchema("Mahutavus (capacity) blurb", { highlight: true }),
            expenses: sectionSchema("Reisikulutused (travel expenses) blurb", { highlight: true }),
            sector: sectionSchema("Majutussektori majandus (accommodation sector turnover) blurb", { highlight: true }),
          },
          required: ["headline", "keyInsights", "dashboard", "map", "purpose", "capacity", "expenses", "sector"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "emit_narrative" },
  });

  assertComplete(response, "section narrative");
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a tool_use block");
  return normalizeSections(toolUse.input);
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

  // .stream() + .finalMessage() instead of .create(): the Anthropic SDK
  // refuses a non-streaming call at this max_tokens ("Streaming is
  // required for operations that may take longer than 10 minutes") since
  // it can't rule out a long generation up front. finalMessage() waits
  // for the stream to finish and hands back the same assembled Message
  // shape .create() would have, so nothing below this call needs to
  // change for it.
  const response = await anthropic.messages
    .stream({
      model,
      // 18 regions x 2 languages x up to 190 words, plus tool-call JSON
      // overhead, occasionally exceeded the old 16000 ceiling (observed
      // 2026-09-11: truncated mid-generation, whole run aborted safely with
      // no bad data committed, but also no update until the next retry).
      // Generous headroom here instead of a tight estimate.
      max_tokens: 32000,
      system:
        "You write region-specific blurbs for a personal Estonian tourism statistics site ('Eesti Turism'), shown " +
        "when a visitor picks a specific county or city in the dashboard's region selector, replacing the national " +
        "overview text — this is the centerpiece of that region's own page, so give it real depth, not a caption. " +
        "Ground every sentence strictly in the numbers given for THAT region, and in that region's pre-verified " +
        "noteworthy contrast where one is given — never invent, round loosely, or borrow a number from another " +
        "region. Each blurb is 130-190 words of plain prose (no headings, no bullet points, no markdown), and " +
        "must LEAD with the region's year-to-date period (January through the latest month): accommodated " +
        "guests, nights, and domestic vs foreign guests, each with its change versus the same months last year. " +
        "Only after that, briefly, the latest single month's figures. Produce independently " +
        "well-written Estonian and English versions of each (not literal translations of each other, though they " +
        "must report the same facts). Estonian must read naturally to a native speaker. Vary sentence structure " +
        "across regions rather than repeating the same template for every one.\n\n" +
        "ACCURACY RULES (apply to every region's blurb):\n" +
        "- Never describe a trend as 'stable', 'consistent', 'steady', or similar unless the data given actually " +
        "shows multiple periods moving the same direction — a single period's number is not a trend.\n" +
        "- Never state or imply a cause for a change (no 'because', 'driven by', 'thanks to', 'due to') unless a " +
        "cause is explicitly given in the data.\n" +
        "- Never make a profitability, revenue, or business-performance claim from occupancy or price data alone.\n" +
        "- Never add a subjective qualifier to a number ('only', 'just', 'merely') unless the data itself gives " +
        "you the comparison point that justifies it.\n" +
        `- Never use these exact phrases or close paraphrases, in Estonian or English: ${BANNED_PHRASES_ET.join("; ")}.\n\n` +
        FORMATTING_RULES,
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
                    et: { type: "string", description: "130-190 word Estonian blurb." },
                    en: { type: "string", description: "130-190 word English blurb." },
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
    })
    .finalMessage();

  if (response.stop_reason === "max_tokens") {
    throw new Error("Region narrative generation was truncated (hit max_tokens) — raise max_tokens and retry.");
  }

  assertComplete(response, "region narrative");
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse) throw new Error("Claude did not return a tool_use block for regions");
  // Same defensive parsing as normalizeSections (lib/guards.mjs) — Claude's tool-calling
  // doesn't always respect the schema's array type, observed here returning
  // a JSON-encoded string instead in some runs.
  const list = typeof toolUse.input.regions === "string" ? JSON.parse(toolUse.input.regions) : toolUse.input.regions;
  if (!Array.isArray(list)) {
    throw new Error(`Region narrative tool call did not return an array: ${JSON.stringify(toolUse.input).slice(0, 300)}`);
  }

  // Claude's tool call has occasionally returned malformed entries for a
  // subset of regions on this large a batch (18 regions in one call) —
  // observed once as a literal "__ET_PLACEHOLDER__" string and missing
  // `et` fields entirely for the rest, silently shipped to production
  // since nothing checked the content before this validation existed.
  // An isolated bad entry is dropped (NarrativeBlock.jsx already falls
  // back to the national blurb for any region code missing from this
  // map); if a large fraction fail, that's a systemic generation
  // problem, not a one-off glitch — fail loudly instead of shipping a
  // broken/degraded regional experience for most of the country.
  function isValidBlurb(text) {
    return typeof text === "string" && !text.includes("PLACEHOLDER") && text.trim().split(/\s+/).length >= 40;
  }

  const byCode = {};
  let invalidCount = 0;
  for (const entry of list) {
    if (!entry?.code || !isValidBlurb(entry.et) || !isValidBlurb(entry.en)) {
      console.warn(
        `  region blurb for ${entry?.code ?? "(missing code)"} failed validation — omitting, will fall back to the national blurb for this region`
      );
      invalidCount++;
      continue;
    }
    byCode[entry.code] = { et: entry.et, en: entry.en };
  }

  if (invalidCount > regions.length * 0.3) {
    throw new Error(
      `${invalidCount} of ${regions.length} region blurbs failed validation (missing/placeholder/too-short text) — ` +
        "this looks like a systemic generation failure, not an isolated glitch. Aborting instead of shipping " +
        "degraded region data; re-run once fixed."
    );
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

// Numeric facts for the redesigned PDF (Task 3.1's KPI cards + lean tables)
// — plain numbers already computed above, not AI prose. Kept separate from
// `sections` (the Claude-written text) so the PDF can render KPI tiles and
// tables straight from verified figures instead of re-deriving them from
// prose or re-scraping the DOM.
function buildFacts(dashboard, capacity, regionalOccPrice, countyLabelByCode) {
  const national = {
    period: dashboard.period,
    periodLabel: dashboard.periodLabel,
    totalGuests: dashboard.totalGuests,
    totalGuestsYoyPct: dashboard.totalGuestsYoyPct,
    totalNights: dashboard.totalNights,
    totalNightsYoyPct: dashboard.totalNightsYoyPct,
    domesticGuests: dashboard.domesticGuests,
    domesticGuestsYoyPct: dashboard.domesticGuestsYoyPct,
    foreignGuests: dashboard.foreignGuests,
    foreignGuestsYoyPct: dashboard.foreignGuestsYoyPct,
    avgNightsPerGuest: dashboard.avgNightsPerGuest,
    avgNightsPerGuestYoyPct: dashboard.avgNightsPerGuestYoyPct,
    cumulativeGuests: dashboard.cumulativeGuests,
    cumulativeGuestsYoyPct: dashboard.cumulativeGuestsYoyPct,
    occupancyPct: capacity.occupancyPct,
    occupancyPctYoy: capacity.occupancyPctYoy,
    occupancyPeriodLabel: capacity.occupancyPeriodLabel,
    avgNightCost: capacity.avgNightCost,
    avgNightCostYoyPct: capacity.avgNightCostYoyPct,
  };

  const regions = {};
  for (const [code, m] of Object.entries(dashboard.regions ?? {})) {
    if (!m) continue;
    const occPrice = regionalOccPrice?.[code] ?? null;
    regions[code] = {
      label: countyLabelByCode(code),
      period: m.period,
      periodLabel: m.periodLabel,
      totalGuests: m.totalGuests,
      totalGuestsYoyPct: m.totalGuestsYoyPct,
      totalNights: m.totalNights,
      totalNightsYoyPct: m.totalNightsYoyPct,
      domesticGuests: m.domesticGuests,
      domesticGuestsYoyPct: m.domesticGuestsYoyPct,
      foreignGuests: m.foreignGuests,
      foreignGuestsYoyPct: m.foreignGuestsYoyPct,
      avgNightsPerGuest: m.avgNightsPerGuest,
      avgNightsPerGuestYoyPct: m.avgNightsPerGuestYoyPct,
      shareOfNationalPct: m.shareOfNationalPct,
      cumulativeGuests: m.cumulativeGuests,
      cumulativeGuestsYoyPct: m.cumulativeGuestsYoyPct,
      occupancyPct: occPrice?.occupancyPct ?? null,
      occupancyPctYoy: occPrice?.occupancyPctYoy ?? null,
      avgNightCost: occPrice?.avgNightCost ?? null,
      avgNightCostYoyPct: occPrice?.avgNightCostYoyPct ?? null,
    };
  }

  return { national, regions, topCounty: dashboard.topCounty };
}

// Which county's blurb/table page 2 should show when the reader generated
// the PDF from a page that isn't itself a specific-county view (the root
// "/" dashboard) — picks the most newsworthy county from the ranked
// findings rather than always falling back to the routing default (Harju).
// A finding's own `code` wins (it's already the most-important one, since
// rankedFindings is sorted); falling back to the single most-visited county
// only happens when no ranked finding names a county at all.
function computeFeaturedRegionCode(rankedFindings, dashboard) {
  const withCode = rankedFindings.find((f) => f.code);
  if (withCode) return withCode.code;
  return dashboard.topCounty?.code ?? null;
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

  const [map, purpose, capacity, expenses, nationalYearlyResidency, regionalOccPrice, sector] = await Promise.all([
    computeMapMetrics(dashboard),
    computePurposeMetrics(),
    computeCapacityMetrics(),
    computeExpensesMetrics(),
    computeNationalYearlyTrend(),
    computeRegionalOccupancyPrice(),
    computeSectorMetrics(),
  ]);

  // Stage 1 of the two-stage pipeline (Task 2.4): every number in a
  // "finding" below was computed here in code, from the fetched data above
  // — nothing in this list is something Claude calculated or decided was
  // interesting. Stage 2 (the Claude calls just below) only turns a short,
  // ranked selection of these into prose.
  const countyLabelByCode = (code) => ALL_REGIONS.find((r) => r.code === code)?.et ?? code;
  const allFindings = detectFindings({ dashboard, map, purpose, capacity, regionalOccPrice }, countyLabelByCode);
  const rankedFindings = rankFindings(allFindings);
  const regionDivergences = findingsByRegionCode(allFindings);
  const facts = buildFacts(dashboard, capacity, regionalOccPrice, countyLabelByCode);
  const featuredRegionCode = computeFeaturedRegionCode(rankedFindings, dashboard);

  const regionPromptBlocks = ALL_REGIONS.map((r) =>
    buildRegionDashboardPrompt(r, dashboard.regions[r.code], regionDivergences[r.code])
  ).filter(Boolean);

  if (process.argv.includes("--debug-metrics")) {
    console.log(JSON.stringify({ dashboard, map, purpose, capacity, expenses, nationalYearlyResidency }, null, 2));
    console.log("--- findings (all, unranked) ---");
    console.log(JSON.stringify(allFindings, null, 2));
    console.log("--- findings (ranked, sent to Claude) ---");
    console.log(JSON.stringify(rankedFindings, null, 2));
    console.log("--- featuredRegionCode ---");
    console.log(featuredRegionCode);
    console.log("--- facts (for PDF KPI cards / tables) ---");
    console.log(JSON.stringify(facts, null, 2));
    console.log("--- prompts ---");
    console.log(buildDashboardPrompt(dashboard));
    console.log(buildMapPrompt(map));
    console.log(buildPurposePrompt(purpose));
    console.log(buildCapacityPrompt(capacity));
    console.log(buildExpensesPrompt(expenses));
    console.log(buildSectorPrompt(sector));
    console.log("--- region prompts ---");
    console.log(regionPromptBlocks.join("\n\n"));
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

  console.log("Calling Claude to generate all six section blurbs…");
  const sections = await callClaude(
    anthropic,
    model,
    {
      dashboard: buildDashboardPrompt(dashboard),
      map: buildMapPrompt(map),
      purpose: buildPurposePrompt(purpose),
      capacity: buildCapacityPrompt(capacity),
      expenses: buildExpensesPrompt(expenses),
      sector: buildSectorPrompt(sector),
    },
    rankedFindings
  );

  console.log(`Calling Claude to generate ${ALL_REGIONS.length} region-specific dashboard blurbs…`);
  sections.dashboardByRegion = await callClaudeRegions(anthropic, model, ALL_REGIONS, regionPromptBlocks);
  sections.dashboard.nationalYearlyResidency = nationalYearlyResidency;

  const output = {
    generatedAt: new Date().toISOString(),
    period: dashboard.period,
    periodLabel: {
      et: dashboard.periodLabel,
      en: formatPeriodLabel(dashboard.period, null, "en"),
    },
    sections,
    facts,
    featuredRegionCode,
  };

  // Task 5.4: a hard gate before publishing — a run with any error-level
  // finding does NOT overwrite the last known-good narrative.json, the
  // same way a failed test suite blocks a deploy. Task 5.1's change
  // detection (a plain diff against the previous run's headline numbers)
  // is logged regardless of pass/fail, for visibility in the CI log.
  const qa = runPrePublishChecks(output, {
    previous: existing,
    allRegionCodes: ALL_REGIONS.map((r) => r.code),
    bannedPhrases: BANNED_PHRASES_ET,
  });

  console.log("--- change since last publish ---");
  for (const line of qa.changeLog) console.log(`  ${line}`);

  if (qa.warnings.length) {
    console.log("--- pre-publish QA warnings (not blocking) ---");
    for (const w of qa.warnings) console.log(`  ⚠ ${w}`);
  }

  if (qa.errors.length) {
    console.error("--- pre-publish QA errors — NOT publishing ---");
    for (const e of qa.errors) console.error(`  ✗ ${e}`);
    throw new Error(`Pre-publish QA failed with ${qa.errors.length} error(s); narrative.json was not updated.`);
  }

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
